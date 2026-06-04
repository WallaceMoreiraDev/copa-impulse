import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { ArrowLeft, Flame, Trophy, Users, TrendingUp } from "lucide-react";

const PHASES = [
  "Fase de Grupos",
  "Oitavas de Final",
  "Quartas de Final",
  "Semifinal",
  "Final",
];

const ITEMS_PER_PAGE = 10;

export default function PublicPredictions() {
  const [allMatches, setAllMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePhase, setActivePhase] = useState(PHASES[0]);
  const [activeGroup, setActiveGroup] = useState("Todos");
  const [userId, setUserId] = useState(null);

  // Controle de paginação visual
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  useEffect(() => {
    loadPredictions();
  }, []);

  const loadPredictions = async () => {
    setLoading(true);
    setVisibleCount(ITEMS_PER_PAGE);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    setUserId(session?.user?.id || null);

    // 1. Buscar todos os jogos NÃO finalizados
    const { data: matchesData, error: matchesError } = await supabase
      .from("matches")
      .select("*")
      .neq("status", "finalizado")
      .order("match_date", { ascending: true });

    if (matchesError) {
      console.error(matchesError);
      setLoading(false);
      return;
    }

    if (!matchesData || matchesData.length === 0) {
      setAllMatches([]);
      setLoading(false);
      return;
    }

    const matchIds = matchesData.map((m) => m.id);

    // 2. Buscar palpites
    const { data: guessesData, error: guessesError } = await supabase
      .from("guesses")
      .select("id, guess_a, guess_b, user_id, match_id")
      .in("match_id", matchIds);

    if (guessesError) {
      console.error(guessesError);
      setLoading(false);
      return;
    }

    // 3. Buscar perfis dos usuários envolvidos nos palpites
    let profileMap = {};
    if (guessesData && guessesData.length > 0) {
      const userIds = [...new Set(guessesData.map((g) => g.user_id))];
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, full_name")
        .in("id", userIds);
      if (!profilesError && profilesData) {
        profileMap = {};
        profilesData.forEach((p) => {
          profileMap[p.id] = p;
        });
      }
    }

    // 4. Organizar dados por jogo
    const matchesWithGuesses = matchesData.map((match) => {
      const guessesForMatch =
        guessesData?.filter((g) => g.match_id === match.id) || [];
      const frequency = {};
      guessesForMatch.forEach((g) => {
        const key = `${g.guess_a}x${g.guess_b}`;
        frequency[key] = (frequency[key] || 0) + 1;
      });
      let consensus = null;
      let maxCount = 0;
      for (const [placar, count] of Object.entries(frequency)) {
        if (count > maxCount) {
          maxCount = count;
          consensus = placar;
        }
      }
      const [consensusA, consensusB] = consensus
        ? consensus.split("x").map(Number)
        : [null, null];

      const guessesWithProfile = guessesForMatch.map((g) => ({
        ...g,
        profiles: profileMap[g.user_id] || {
          username: "Anônimo",
          full_name: "Anônimo",
        },
      }));

      const sortedGuesses = [...guessesWithProfile].sort((a, b) => {
        if (a.user_id === userId) return -1;
        if (b.user_id === userId) return 1;
        return (a.profiles?.username || "").localeCompare(
          b.profiles?.username || "",
        );
      });

      return {
        ...match,
        guesses: sortedGuesses,
        consensus: { a: consensusA, b: consensusB, count: maxCount },
        totalGuesses: guessesForMatch.length,
      };
    });

    setAllMatches(matchesWithGuesses);
    setLoading(false);
  };

  // Filtros
  const matchesByPhaseGroup = allMatches.filter((m) => m.fase === activePhase);
  const finalMatches = (() => {
    if (activePhase === "Fase de Grupos" && activeGroup !== "Todos") {
      return matchesByPhaseGroup.filter((m) => m.grupo === activeGroup);
    }
    return matchesByPhaseGroup;
  })();

  // Paginação visual
  const visibleMatches = finalMatches.slice(0, visibleCount);
  const hasMore = visibleCount < finalMatches.length;

  const loadMore = () => {
    setVisibleCount((prev) => prev + ITEMS_PER_PAGE);
  };

  const resetPagination = () => {
    setVisibleCount(ITEMS_PER_PAGE);
  };

  // Resetar paginação ao trocar fase/grupo
  useEffect(() => {
    resetPagination();
  }, [activePhase, activeGroup]);

  const availableGroups = [
    "Todos",
    ...new Set(
      allMatches
        .filter((m) => m.fase === "Fase de Grupos" && m.grupo)
        .map((m) => m.grupo)
        .sort(),
    ),
  ];

  const isBoldPrediction = (guessA, guessB) => Math.abs(guessA - guessB) >= 3;

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
        Carregando previsões...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-4 md:p-8 font-sans text-zinc-100">
      <div className="max-w-4xl mx-auto">
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
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

        {/* Título */}
        <div className="flex items-center gap-2 mb-6">
          <Users className="w-6 h-6 text-green-500" />
          <h1 className="text-xl md:text-2xl font-bold text-white">
            Previsões da galera
          </h1>
        </div>

        {/* Filtro de fases */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-2 border-b border-zinc-800">
          {PHASES.map((fase) => (
            <button
              key={fase}
              onClick={() => {
                setActivePhase(fase);
                setActiveGroup("Todos");
              }}
              className={`whitespace-nowrap px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                activePhase === fase
                  ? "bg-green-500 text-white"
                  : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white border border-zinc-800"
              }`}
            >
              {fase}
            </button>
          ))}
        </div>

        {/* Sub-filtro de grupos */}
        {activePhase === "Fase de Grupos" && availableGroups.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-4 mb-4">
            {availableGroups.map((grupo) => (
              <button
                key={grupo}
                onClick={() => setActiveGroup(grupo)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full font-medium text-xs transition-colors ${
                  activeGroup === grupo
                    ? "bg-zinc-100 text-zinc-900"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {grupo === "Todos" ? "Todos" : `Grupo ${grupo}`}
              </button>
            ))}
          </div>
        )}

        {/* Lista de jogos */}
        <div className="space-y-4">
          {visibleMatches.map((match) => (
            <div
              key={match.id}
              className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"
            >
              {/* Cabeçalho */}
              <div className="px-5 pt-4 pb-2 border-b border-zinc-800/50 flex flex-wrap justify-between items-center gap-2">
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
                </div>
                <div className="text-xs text-zinc-500">
                  {match.totalGuesses} palpite
                  {match.totalGuesses !== 1 ? "s" : ""}
                </div>
              </div>

              {/* Times */}
              <div className="px-5 pt-4 pb-2">
                <div className="flex items-center justify-center gap-4 text-lg font-bold">
                  <span className="text-right">{match.team_a}</span>
                  <span className="text-zinc-500">vs</span>
                  <span className="text-left">{match.team_b}</span>
                </div>
              </div>

              {/* Lista de palpites */}
              <div className="px-5 pb-4">
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                  {match.guesses.length === 0 ? (
                    <div className="text-center text-zinc-500 text-sm py-4">
                      Ninguém palpitou ainda. Seja o primeiro!
                    </div>
                  ) : (
                    match.guesses.map((guess) => {
                      const isUser = guess.user_id === userId;
                      const isBold = isBoldPrediction(
                        guess.guess_a,
                        guess.guess_b,
                      );
                      return (
                        <div
                          key={guess.id}
                          className={`flex justify-between items-center text-sm pl-4 py-1 border-b border-zinc-800/30 ${
                            isUser ? "bg-green-900/10 -mx-2 px-2 rounded" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-zinc-300">
                              {guess.profiles?.username ||
                                guess.profiles?.full_name ||
                                "Anônimo"}
                            </span>
                            {isUser && (
                              <span className="text-xs bg-green-600 px-1.5 py-0.5 rounded-full">
                                Você
                              </span>
                            )}
                            {isBold && (
                              <span
                                className="flex items-center gap-0.5 text-amber-400"
                                title="Palpite ousado!"
                              >
                                <Flame size={12} />{" "}
                                <span className="text-[10px]">ousado</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 font-mono">
                            <span className="text-green-400">
                              {guess.guess_a}
                            </span>
                            <span className="text-zinc-600">x</span>
                            <span className="text-green-400">
                              {guess.guess_b}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Consenso popular */}
                {match.consensus.count > 0 && (
                  <div className="mt-3 pt-2 border-t border-zinc-800/50 flex justify-between items-center text-xs text-zinc-400">
                    <div className="flex items-center gap-1">
                      <TrendingUp size={14} />
                      Consenso popular:
                    </div>
                    <div>
                      {match.consensus.a} x {match.consensus.b}
                      <span className="ml-1 text-zinc-500">
                        ({match.consensus.count} palpite
                        {match.consensus.count !== 1 ? "s" : ""})
                      </span>
                    </div>
                  </div>
                )}

                {/* Botão para palpitar */}
                <div className="mt-3 text-right">
                  <button
                    onClick={() => (window.location.href = "/dashboard")}
                    className="text-green-500 hover:text-green-400 text-sm font-medium inline-flex items-center gap-1 transition-colors"
                  >
                    <Trophy size={14} /> Dar meu palpite
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Botão "Carregar mais" */}
          {hasMore && (
            <div className="flex justify-center py-4">
              <button
                onClick={loadMore}
                className="bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors text-sm"
              >
                Carregar mais {ITEMS_PER_PAGE} jogos
              </button>
            </div>
          )}

          {/* Indicador de total carregado */}
          {finalMatches.length > ITEMS_PER_PAGE && (
            <div className="text-center text-xs text-zinc-500 pt-2">
              Mostrando {visibleMatches.length} de {finalMatches.length} jogos
            </div>
          )}

          {visibleMatches.length === 0 && (
            <div className="text-center py-12 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
              <p className="text-zinc-500 font-medium">
                Nenhum jogo futuro nesta fase.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
