import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import {
  ArrowLeft,
  Flag,
  Trophy,
  Calendar,
  Target,
  TrendingUp,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";

export default function BrazilGames() {
  const [matches, setMatches] = useState([]);
  const [userGuesses, setUserGuesses] = useState({});
  const [stats, setStats] = useState({
    totalGames: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    userExactHits: 0,
    userWinnerHits: 0,
    userWrong: 0,
  });
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    loadBrazilData();
  }, []);

  const loadBrazilData = async () => {
    setLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) setUserId(session.user.id);

    // 1. Buscar jogos do Brasil
    const { data: matchesData, error: matchesError } = await supabase
      .from("matches")
      .select("*")
      .or("team_a.eq.Brasil,team_b.eq.Brasil")
      .order("match_date", { ascending: true });

    if (matchesError) {
      console.error(matchesError);
      setLoading(false);
      return;
    }

    const matchIds = matchesData.map((m) => m.id);

    // 2. Buscar todos os palpites (de todos os usuários)
    const { data: guessesData } = await supabase
      .from("guesses")
      .select("*")
      .in("match_id", matchIds);

    // 3. Buscar perfis dos usuários que palpitarem
    let profileMap = {};
    if (guessesData && guessesData.length > 0) {
      const userIds = [...new Set(guessesData.map((g) => g.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, username, full_name")
        .in("id", userIds);
      if (profilesData) {
        profileMap = Object.fromEntries(profilesData.map((p) => [p.id, p]));
      }
    }

    // 4. Mapa de palpites do usuário logado (para exibir destaque)
    const userGuessMap = {};
    (guessesData || []).forEach((g) => {
      if (g.user_id === session?.user?.id) {
        userGuessMap[g.match_id] = g;
      }
    });
    setUserGuesses(userGuessMap);

    // 5. Estatísticas do Brasil (resultados reais)
    let totalGames = 0,
      wins = 0,
      draws = 0,
      losses = 0,
      goalsFor = 0,
      goalsAgainst = 0;
    const finishedMatches = matchesData.filter(
      (m) =>
        m.status === "finalizado" && m.goals_a !== null && m.goals_b !== null,
    );
    finishedMatches.forEach((m) => {
      totalGames++;
      const brasilGoals = m.team_a === "Brasil" ? m.goals_a : m.goals_b;
      const opponentGoals = m.team_a === "Brasil" ? m.goals_b : m.goals_a;
      goalsFor += brasilGoals;
      goalsAgainst += opponentGoals;
      if (brasilGoals > opponentGoals) wins++;
      else if (brasilGoals === opponentGoals) draws++;
      else losses++;
    });

    // 6. Estatísticas do usuário logado
    let userExactHits = 0,
      userWinnerHits = 0,
      userWrong = 0;
    finishedMatches.forEach((m) => {
      const guess = userGuessMap[m.id];
      if (!guess) return;
      const brasilGoals = m.team_a === "Brasil" ? m.goals_a : m.goals_b;
      const opponentGoals = m.team_a === "Brasil" ? m.goals_b : m.goals_a;
      const guessBrasil = m.team_a === "Brasil" ? guess.guess_a : guess.guess_b;
      const guessOpponent =
        m.team_a === "Brasil" ? guess.guess_b : guess.guess_a;
      if (guessBrasil === brasilGoals && guessOpponent === opponentGoals)
        userExactHits++;
      else if (
        (guessBrasil > guessOpponent && brasilGoals > opponentGoals) ||
        (guessBrasil < guessOpponent && brasilGoals < opponentGoals) ||
        (guessBrasil === guessOpponent && brasilGoals === opponentGoals)
      )
        userWinnerHits++;
      else userWrong++;
    });

    setStats({
      totalGames,
      wins,
      draws,
      losses,
      goalsFor,
      goalsAgainst,
      userExactHits,
      userWinnerHits,
      userWrong,
    });

    // 7. Ranking dos usuários nos jogos do Brasil
    const allUserIds = [...new Set((guessesData || []).map((g) => g.user_id))];
    if (allUserIds.length > 0) {
      const { data: profilesRank } = await supabase
        .from("profiles")
        .select("id, username, full_name")
        .in("id", allUserIds);
      const rankProfileMap = {};
      (profilesRank || []).forEach((p) => {
        rankProfileMap[p.id] = p;
      });

      const userPoints = {};
      finishedMatches.forEach((m) => {
        const matchGuesses =
          guessesData?.filter((g) => g.match_id === m.id) || [];
        matchGuesses.forEach((g) => {
          const points = g.points_earned || 0;
          userPoints[g.user_id] = (userPoints[g.user_id] || 0) + points;
        });
      });
      const rankingList = Object.entries(userPoints)
        .map(([id, total]) => ({
          id,
          username:
            rankProfileMap[id]?.username ||
            rankProfileMap[id]?.full_name ||
            "Anônimo",
          total_points: total,
        }))
        .sort((a, b) => b.total_points - a.total_points);
      setRanking(rankingList);
    } else {
      setRanking([]);
    }

    // 8. Montar jogos com lista de palpites de todos os usuários
    const matchesWithAllGuesses = matchesData.map((match) => {
      const matchGuesses =
        guessesData?.filter((g) => g.match_id === match.id) || [];
      const guessesWithProfile = matchGuesses.map((g) => ({
        ...g,
        profiles: profileMap[g.user_id] || {
          username: "Anônimo",
          full_name: "Anônimo",
        },
      }));
      // Ordenar: usuário logado primeiro, depois por username
      const sortedGuesses = [...guessesWithProfile].sort((a, b) => {
        if (a.user_id === session?.user?.id) return -1;
        if (b.user_id === session?.user?.id) return 1;
        return (a.profiles?.username || "").localeCompare(
          b.profiles?.username || "",
        );
      });
      return { ...match, allGuesses: sortedGuesses };
    });

    setMatches(matchesWithAllGuesses);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-4 md:p-8 font-sans text-zinc-100">
      <div className="max-w-5xl mx-auto">
        {/* Cabeçalho gradiente */}
        <div className="relative rounded-2xl overflow-hidden mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-green-600/20 via-yellow-500/10 to-blue-600/20" />
          <div className="relative flex flex-col md:flex-row justify-between items-center gap-4 p-6">
            <div className="flex items-center gap-3">
              <Flag className="w-8 h-8 text-green-500" />
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">
                  Caminho do Hexa
                </h1>
                <p className="text-zinc-400 text-sm">
                  Acompanhe a trajetória do Brasil na copa do mundo
                </p>
              </div>
            </div>
            <button
              onClick={() => (window.location.href = "/dashboard")}
              className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
            >
              <ArrowLeft size={16} /> Voltar ao Dashboard
            </button>
          </div>
        </div>

        {/* Cards de estatísticas do Brasil */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
            <Trophy className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{stats.wins}</p>
            <p className="text-xs text-zinc-400">Vitórias</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
            <Target className="w-6 h-6 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{stats.goalsFor}</p>
            <p className="text-xs text-zinc-400">Gols marcados</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
            <AlertCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">
              {stats.goalsAgainst}
            </p>
            <p className="text-xs text-zinc-400">Gols sofridos</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
            <Calendar className="w-6 h-6 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{stats.totalGames}</p>
            <p className="text-xs text-zinc-400">Jogos disputados</p>
          </div>
        </div>

        {/* Seu desempenho */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-8">
          <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            Seu desempenho nos jogos do Brasil
          </h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-green-400">
                {stats.userExactHits}
              </p>
              <p className="text-xs text-zinc-400">Acertos exatos</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-400">
                {stats.userWinnerHits}
              </p>
              <p className="text-xs text-zinc-400">Acertos de vencedor</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-400">
                {stats.userWrong}
              </p>
              <p className="text-xs text-zinc-400">Erros</p>
            </div>
          </div>
        </div>

        {/* Ranking do Brasil */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-8">
          <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            Ranking dos palpites (jogos do Brasil)
          </h2>
          {ranking.length === 0 ? (
            <p className="text-zinc-500 text-sm">
              Nenhum palpite registrado ainda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-zinc-400 border-b border-zinc-800">
                  <tr>
                    <th className="p-2 text-left">Pos</th>
                    <th className="p-2 text-left">Jogador</th>
                    <th className="p-2 text-right">Pontos</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((user, idx) => (
                    <tr key={user.id} className="border-t border-zinc-800">
                      <td className="p-2">{idx + 1}º</td>
                      <td className="p-2">{user.username}</td>
                      <td className="p-2 text-right font-bold text-green-400">
                        {user.total_points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Lista de jogos do Brasil */}
        <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-green-500" />
          Todos os jogos da Seleção
        </h2>
        <div className="space-y-3">
          {matches.map((match) => {
            const isFinished = match.status === "finalizado";
            const userGuess = userGuesses[match.id];
            const brasilGoals =
              match.team_a === "Brasil" ? match.goals_a : match.goals_b;
            const opponentGoals =
              match.team_a === "Brasil" ? match.goals_b : match.goals_a;
            const guessBrasil = userGuess
              ? match.team_a === "Brasil"
                ? userGuess.guess_a
                : userGuess.guess_b
              : null;
            const guessOpponent = userGuess
              ? match.team_a === "Brasil"
                ? userGuess.guess_b
                : userGuess.guess_a
              : null;
            const isExact =
              isFinished &&
              guessBrasil === brasilGoals &&
              guessOpponent === opponentGoals;
            const isWinner =
              isFinished &&
              !isExact &&
              ((guessBrasil > guessOpponent && brasilGoals > opponentGoals) ||
                (guessBrasil < guessOpponent && brasilGoals < opponentGoals) ||
                (guessBrasil === guessOpponent &&
                  brasilGoals === opponentGoals));

            return (
              <div
                key={match.id}
                className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"
              >
                <div className="px-5 pt-4 pb-2 border-b border-zinc-800/50 flex flex-wrap justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-zinc-400">
                      {new Date(match.match_date).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {match.grupo && (
                      <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded-full">
                        Grupo {match.grupo}
                      </span>
                    )}
                    <span className="text-xs text-zinc-500">{match.fase}</span>
                  </div>
                  {isFinished && (
                    <span className="text-xs bg-green-900/50 text-green-300 px-2 py-0.5 rounded-full">
                      Finalizado
                    </span>
                  )}
                </div>

                <div className="p-5">
                  {/* Times com bandeiras */}
                  <div className="flex items-center justify-center gap-4 text-lg font-bold mb-3">
                    <div className="flex items-center gap-2">
                      {match.team_a_logo && (
                        <img
                          src={match.team_a_logo}
                          alt={match.team_a}
                          className="w-6 h-6 object-contain"
                        />
                      )}
                      <span>{match.team_a}</span>
                    </div>
                    <span className="text-zinc-500">vs</span>
                    <div className="flex items-center gap-2">
                      <span>{match.team_b}</span>
                      {match.team_b_logo && (
                        <img
                          src={match.team_b_logo}
                          alt={match.team_b}
                          className="w-6 h-6 object-contain"
                        />
                      )}
                    </div>
                  </div>

                  {/* Palpite do usuário + resultado */}
                  {userGuess ? (
                    <div className="flex justify-center items-center gap-6 text-sm bg-zinc-950 rounded-lg p-3">
                      <div className="text-center">
                        <p className="text-zinc-400 text-xs">Seu palpite</p>
                        <p className="text-xl font-bold text-green-400">
                          {guessBrasil} x {guessOpponent}
                        </p>
                      </div>
                      {isFinished && (
                        <>
                          <div className="text-center">
                            <p className="text-zinc-400 text-xs">Resultado</p>
                            <p className="text-xl font-bold text-white">
                              {brasilGoals} x {opponentGoals}
                            </p>
                          </div>
                          <div className="text-center">
                            {isExact && (
                              <CheckCircle
                                className="w-6 h-6 text-green-500"
                                title="Placar exato!"
                              />
                            )}
                            {isWinner && (
                              <TrendingUp
                                className="w-6 h-6 text-yellow-500"
                                title="Acertou o vencedor"
                              />
                            )}
                            {!isExact && !isWinner && isFinished && (
                              <XCircle
                                className="w-6 h-6 text-red-500"
                                title="Errou"
                              />
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="text-center text-zinc-500 text-sm py-2">
                      Você ainda não palpitou neste jogo.
                    </div>
                  )}

                  {/* === NOVO: Lista de palpites de todos os usuários === */}
                  {match.allGuesses && match.allGuesses.length > 0 && (
                    <div className="mt-4 border-t border-zinc-800 pt-3">
                      <p className="text-zinc-400 text-xs mb-2">
                        Palpites da galera:
                      </p>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {match.allGuesses.map((guess) => {
                          const isCurrentUser = guess.user_id === userId;
                          const gBrasil =
                            match.team_a === "Brasil"
                              ? guess.guess_a
                              : guess.guess_b;
                          const gOpponent =
                            match.team_a === "Brasil"
                              ? guess.guess_b
                              : guess.guess_a;
                          return (
                            <div
                              key={guess.id}
                              className={`text-xs flex justify-between items-center ${isCurrentUser ? "bg-green-900/20 px-2 py-0.5 rounded" : ""}`}
                            >
                              <span className="font-medium text-zinc-300">
                                {guess.profiles?.username ||
                                  guess.profiles?.full_name ||
                                  "Anônimo"}
                                {isCurrentUser && (
                                  <span className="ml-1 text-green-400">
                                    (Você)
                                  </span>
                                )}
                              </span>
                              <span className="font-mono text-green-400">
                                {gBrasil} x {gOpponent}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {!isFinished && (
                    <div className="mt-3 text-right">
                      <button
                        onClick={() => (window.location.href = "/dashboard")}
                        className="text-green-500 hover:text-green-400 text-sm font-medium inline-flex items-center gap-1 transition-colors"
                      >
                        <Target size={14} /> Dar meu palpite
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {matches.length === 0 && (
            <div className="text-center py-8 text-zinc-500">
              Nenhum jogo do Brasil encontrado.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
