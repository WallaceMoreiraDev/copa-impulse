import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { Trophy, Medal, ArrowLeft, Flame } from "lucide-react";

export default function Ranking() {
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    loadRanking();
  }, []);

  const loadRanking = async () => {
    setLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) setUserId(session.user.id);

    // 1. Buscar perfis
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, username, full_name, total_points, exatos_count")
      .eq("active", true)
      .order("total_points", { ascending: false })
      .order("exatos_count", { ascending: false });

    if (profilesError) {
      console.error(profilesError);
      setLoading(false);
      return;
    }

    if (!profiles || profiles.length === 0) {
      setRanking([]);
      setLoading(false);
      return;
    }

    // 2. Buscar palpites com dados dos jogos (sem relação aninhada problemática)
    const userIds = profiles.map((p) => p.id);
    const { data: guesses, error: guessesError } = await supabase
      .from("guesses")
      .select("user_id, points_earned, match_id")
      .in("user_id", userIds);

    if (guessesError) console.error(guessesError);

    // Buscar informações dos jogos (data, status) separadamente
    const matchIds = [...new Set(guesses?.map((g) => g.match_id) || [])];
    const { data: matches, error: matchesError } = await supabase
      .from("matches")
      .select("id, match_date, status")
      .in("id", matchIds)
      .eq("status", "finalizado");

    if (matchesError) console.error(matchesError);

    // Criar mapa de match por id
    const matchMap = {};
    matches?.forEach((m) => {
      matchMap[m.id] = m;
    });

    // 3. Para cada usuário, coletar palpites de jogos finalizados e ordenar por data
    const streaks = {};
    if (guesses && matches) {
      const userGuesses = {};
      guesses.forEach((g) => {
        const match = matchMap[g.match_id];
        if (match && match.status === "finalizado") {
          if (!userGuesses[g.user_id]) userGuesses[g.user_id] = [];
          userGuesses[g.user_id].push({
            points_earned: g.points_earned,
            match_date: match.match_date,
          });
        }
      });

      for (const [uid, guessList] of Object.entries(userGuesses)) {
        // Ordenar por data crescente (mais antigo primeiro)
        guessList.sort(
          (a, b) => new Date(a.match_date) - new Date(b.match_date),
        );
        // Contar streak do mais recente para trás
        let streak = 0;
        for (let i = guessList.length - 1; i >= 0; i--) {
          if (guessList[i].points_earned > 0) streak++;
          else break;
        }
        streaks[uid] = streak >= 3 ? streak : 0;
      }
    }

    const rankingWithStreak = profiles.map((user) => ({
      ...user,
      streak: streaks[user.id] || 0,
    }));

    setRanking(rankingWithStreak);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
        Carregando ranking...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-4 md:p-8 font-sans text-zinc-100">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
          <img
            src="/logo5.png"
            alt="impulse"
            className="h-8 md:h-10 object-contain"
          />
          <button
            onClick={() => (window.location.href = "/dashboard")}
            className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 px-4 rounded text-sm flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
        </div>
        <div className="flex items-center justify-center sm:justify-start gap-2 mb-6 mt-6">
          <Trophy className="w-6 h-6 text-yellow-500" />
          <h1 className="text-xl md:text-2xl font-bold text-white text-center">
            Ranking dos palpites
          </h1>
        </div>

        <div className="overflow-x-auto bg-zinc-900 rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-800">
              <tr>
                <th className="p-3 text-left w-16">Pos</th>
                <th className="p-3 text-left">Jogador</th>
                <th className="p-3 text-center">Pontos</th>
                <th className="p-3 text-center">Acertos Exatos</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((user, index) => {
                const position = index + 1;
                const isCurrentUser = user.id === userId;
                let medalIcon = null;
                if (position === 1)
                  medalIcon = (
                    <Medal className="w-5 h-5 text-yellow-400 inline mr-1" />
                  );
                else if (position === 2)
                  medalIcon = (
                    <Medal className="w-5 h-5 text-gray-400 inline mr-1" />
                  );
                else if (position === 3)
                  medalIcon = (
                    <Medal className="w-5 h-5 text-amber-600 inline mr-1" />
                  );

                return (
                  <tr
                    key={user.id}
                    className={`border-t border-zinc-800 ${isCurrentUser ? "bg-green-900/30" : "hover:bg-zinc-800/50"}`}
                  >
                    <td className="p-3 font-bold text-center">
                      {medalIcon}
                      {position}
                    </td>
                    <td className="p-3 font-medium">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>{user.username || user.full_name}</span>
                        {user.streak >= 3 && (
                          <span
                            className="inline-flex items-center text-orange-400"
                            title={`${user.streak} acertos consecutivos`}
                          >
                            <Flame size={14} />
                          </span>
                        )}
                        {isCurrentUser && (
                          <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">
                            Você
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-center font-bold text-green-400">
                      {user.total_points ?? 0}
                    </td>
                    <td className="p-3 text-center text-yellow-400">
                      {user.exatos_count ?? 0}
                    </td>
                  </tr>
                );
              })}
              {ranking.length === 0 && (
                <tr>
                  <td colSpan="4" className="text-center py-8 text-zinc-500">
                    Nenhum participante ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-6 text-xs text-zinc-500 text-center">
          <p>Critério de desempate: maior número de acertos exatos.</p>
          <p className="mt-1 flex items-center justify-center gap-1">
            <Flame size={12} className="text-orange-400" /> Ofensiva: 3 ou mais
            acertos consecutivos.
          </p>
        </div>
      </div>
    </div>
  );
}
