import { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabase";
import {
  Trophy,
  BarChart2,
  ArrowUp,
  Users,
  Flame,
  Info,
  Flag,
  Search,
  Menu,
  X,
} from "lucide-react";
import { ConfirmationModal, AlertModal } from "../components/Modal";

const PHASES = [
  "Fase de Grupos",
  "Oitavas de Final",
  "Quartas de Final",
  "Semifinal",
  "Final",
];

const ITEMS_PER_PAGE = 10;

export default function Dashboard() {
  const [allMatches, setAllMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [activePhase, setActivePhase] = useState(PHASES[0]);
  const [activeGroup, setActiveGroup] = useState("Todos");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [streak, setStreak] = useState(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingSaveMatch, setPendingSaveMatch] = useState(null);
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    message: "",
    type: "error",
  });
  const [expandedTeam, setExpandedTeam] = useState({}); // objeto com matchId_team (ex: '123_a' ou '123_b')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Controle de paginação visual
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  // Filtro de busca
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setError(null);
    setLoading(true);
    setVisibleCount(ITEMS_PER_PAGE);
    setSearchTerm("");
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) throw new Error(sessionError.message);
      if (!session) throw new Error("Usuário não autenticado");

      const uid = session.user.id;
      setUserId(uid);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("active")
        .eq("id", uid)
        .single();

      if (profileError) throw new Error(profileError.message);
      if (!profile?.active) {
        setLoading(false);
        return;
      }

      const { data: matchesData, error: matchesError } = await supabase
        .from("matches")
        .select("*")
        .order("match_date", { ascending: true });

      if (matchesError) throw new Error(matchesError.message);

      const { data: guessesData, error: guessesError } = await supabase
        .from("guesses")
        .select("*")
        .eq("user_id", uid);

      if (guessesError) throw new Error(guessesError.message);

      const mergedData = (matchesData || []).map((m) => {
        const guess = guessesData?.find((g) => g.match_id === m.id);
        const pointsEarned = guess?.points_earned ?? null;
        const hasPoints = pointsEarned !== null && pointsEarned > 0;
        return {
          ...m,
          fase: m.fase || "Fase de Grupos",
          grupo: m.grupo || "",
          guess_id: guess?.id || null,
          guess_a: guess?.guess_a !== undefined ? guess.guess_a : "",
          guess_b: guess?.guess_b !== undefined ? guess.guess_b : "",
          points: pointsEarned,
          hasPoints: hasPoints,
          isEditing: !guess?.id,
        };
      });
      setAllMatches(mergedData);
      await calculateStreak(uid);
    } catch (err) {
      console.error("Erro ao carregar dashboard:", err);
      setError(
        err.message || "Falha ao carregar os jogos. Verifique sua conexão.",
      );
    } finally {
      setLoading(false);
    }
  };

  const calculateStreak = async (uid) => {
    try {
      const { data: guesses, error: guessesError } = await supabase
        .from("guesses")
        .select("match_id, points_earned")
        .eq("user_id", uid);

      if (guessesError || !guesses || guesses.length === 0) {
        setStreak(0);
        return;
      }

      const matchIds = guesses.map((g) => g.match_id);
      const { data: matches, error: matchesError } = await supabase
        .from("matches")
        .select("id, match_date, status")
        .in("id", matchIds)
        .eq("status", "finalizado");

      if (matchesError || !matches) {
        setStreak(0);
        return;
      }

      const matchDateMap = {};
      matches.forEach((m) => {
        matchDateMap[m.id] = m.match_date;
      });

      const guessesWithDate = guesses
        .map((g) => ({ ...g, match_date: matchDateMap[g.match_id] }))
        .filter((g) => g.match_date)
        .sort((a, b) => new Date(a.match_date) - new Date(b.match_date));

      let currentStreak = 0;
      for (let i = guessesWithDate.length - 1; i >= 0; i--) {
        if (guessesWithDate[i].points_earned > 0) currentStreak++;
        else break;
      }
      setStreak(currentStreak);
    } catch (err) {
      console.error(err);
      setStreak(0);
    }
  };

  const handleGuessChange = (matchId, team, value) => {
    setAllMatches((prev) =>
      prev.map((m) => (m.id === matchId ? { ...m, [team]: value } : m)),
    );
  };

  const toggleTeamName = (matchId, team) => {
    const key = `${matchId}_${team}`;
    setExpandedTeam((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleMobileNavigation = (url) => {
    setMobileMenuOpen(false);
    window.location.href = url;
  };

  const toggleEdit = (matchId) => {
    setAllMatches((prev) =>
      prev.map((m) => (m.id === matchId ? { ...m, isEditing: true } : m)),
    );
  };

  const saveGuess = async (match) => {
    if (match.guess_a === "" || match.guess_b === "") {
      setAlertModal({
        isOpen: true,
        message: "Preencha o placar completo antes de salvar!",
        type: "error",
      });
      return;
    }
    if (document.activeElement) document.activeElement.blur();
    setSavingId(match.id);

    const payload = {
      user_id: userId,
      match_id: match.id,
      guess_a: parseInt(match.guess_a),
      guess_b: parseInt(match.guess_b),
    };

    let newGuessId = match.guess_id;

    try {
      if (match.guess_id) {
        await supabase.from("guesses").update(payload).eq("id", match.guess_id);
      } else {
        const { data, error } = await supabase
          .from("guesses")
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        if (data) newGuessId = data.id;
      }

      setAllMatches((currentMatches) =>
        currentMatches.map((m) =>
          m.id === match.id
            ? {
                ...m,
                guess_id: newGuessId,
                isEditing: false,
                points: null,
                hasPoints: false,
              }
            : m,
        ),
      );
      setSavedId(match.id);
      setTimeout(() => setSavedId(null), 2000);
    } catch (error) {
      console.error("Erro ao salvar:", error);
      setAlertModal({
        isOpen: true,
        message: "Falha na conexão. Tente novamente.",
        type: "error",
      });
    } finally {
      setSavingId(null);
    }
  };

  const isLocked = (match) => {
    if (match.status === "finalizado") return true;
    const matchTime = new Date(match.match_date).getTime();
    const now = new Date().getTime();
    const diffMinutes = (matchTime - now) / (1000 * 60);
    return diffMinutes <= 30;
  };

  // Filtro por fase e grupo
  const matchesByPhaseGroup = useMemo(() => {
    let filtered = allMatches.filter((m) => m.fase === activePhase);
    if (activePhase === "Fase de Grupos" && activeGroup !== "Todos") {
      filtered = filtered.filter((m) => m.grupo === activeGroup);
    }
    return filtered;
  }, [allMatches, activePhase, activeGroup]);

  // Filtro de busca (por time ou data)
  const filteredMatches = useMemo(() => {
    if (!searchTerm.trim()) return matchesByPhaseGroup;
    const term = searchTerm
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return matchesByPhaseGroup.filter((match) => {
      const teamA = match.team_a
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      const teamB = match.team_b
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      const dateStr = new Date(match.match_date).toLocaleDateString("pt-BR");
      const dateNormalized = dateStr
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return (
        teamA.includes(term) ||
        teamB.includes(term) ||
        dateNormalized.includes(term)
      );
    });
  }, [matchesByPhaseGroup, searchTerm]);

  // Paginação visual
  const visibleMatches = useMemo(() => {
    return filteredMatches.slice(0, visibleCount);
  }, [filteredMatches, visibleCount]);

  const hasMore = visibleCount < filteredMatches.length;

  const loadMore = () => {
    setVisibleCount((prev) => prev + ITEMS_PER_PAGE);
  };

  const resetPagination = () => {
    setVisibleCount(ITEMS_PER_PAGE);
    setSearchTerm("");
  };

  // Quando fase ou grupo mudam, resetar paginação e busca
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

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
        Carregando jogos...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-white p-4">
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-6 text-center max-w-md">
          <p className="text-red-300 mb-4">❌ {error}</p>
          <button
            onClick={() => loadDashboard()}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-semibold"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-4 md:p-8 font-sans text-zinc-100">
      <div className="max-w-3xl mx-auto">
        {/* Cabeçalho */}
        {/* ========== CABEÇALHO RESPONSIVO ========== */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-4">
          {/* Logo + menu desktop (lado a lado em desktop) */}
          <div className="flex justify-between items-center w-full md:w-auto">
            <img
              src="/logo5.png"
              alt="impulse"
              className="h-8 md:h-10 object-contain"
            />
            {/* Botão hambúrguer (mobile) */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden bg-zinc-800 p-2 rounded-lg"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          {/* Menu Desktop (visível apenas em desktop, ao lado da logo) */}
          <div className="hidden md:flex flex-wrap justify-end gap-2">
            <button
              onClick={() => (window.location.href = "/ranking")}
              className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 px-3 md:px-4 rounded text-xs md:text-sm flex items-center gap-1 md:gap-2"
            >
              <Trophy className="w-4 h-4" /> Ranking
            </button>
            <button
              onClick={() => (window.location.href = "/previsoes")}
              className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 px-3 md:px-4 rounded text-xs md:text-sm flex items-center gap-1 md:gap-2"
            >
              <Users className="w-4 h-4" /> Previsões
            </button>
            <button
              onClick={() => (window.location.href = "/stats")}
              className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 px-3 md:px-4 rounded text-xs md:text-sm flex items-center gap-1 md:gap-2"
            >
              <BarChart2 className="w-4 h-4" /> Estatísticas
            </button>
            <button
              onClick={() => (window.location.href = "/brasil")}
              className="bg-gradient-to-r from-green-600/80 via-yellow-500/80 to-blue-600/80 hover:from-green-600 hover:via-yellow-500 hover:to-blue-600 text-white font-bold py-2 px-3 md:px-4 rounded text-xs md:text-sm flex items-center gap-1 md:gap-2"
            >
              <Flag className="w-4 h-4" /> Brasil na Copa
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-red-500 font-bold text-xs md:text-sm hover:underline"
            >
              Sair
            </button>
          </div>

          {/* Menu Mobile Dropdown (aparece abaixo em mobile) */}
          {mobileMenuOpen && (
            <div className="md:hidden bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex flex-col gap-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  window.location.href = "/ranking";
                }}
                className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 px-3 rounded text-sm flex items-center gap-2"
              >
                <Trophy size={16} /> Ranking
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  window.location.href = "/previsoes";
                }}
                className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 px-3 rounded text-sm flex items-center gap-2"
              >
                <Users size={16} /> Previsões
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  window.location.href = "/stats";
                }}
                className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 px-3 rounded text-sm flex items-center gap-2"
              >
                <BarChart2 size={16} /> Estatísticas
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  window.location.href = "/brasil";
                }}
                className="bg-gradient-to-r from-green-600/80 via-yellow-500/80 to-blue-600/80 hover:from-green-600 hover:via-yellow-500 hover:to-blue-600 text-white font-bold py-2 px-3 rounded text-sm flex items-center gap-2"
              >
                <Flag size={16} /> Brasil na Copa
              </button>
              <button
                onClick={() => supabase.auth.signOut()}
                className="text-red-500 font-bold text-sm text-left px-3 py-2 hover:bg-zinc-800 rounded"
              >
                Sair
              </button>
            </div>
          )}
        </div>

        {/* Título */}
        <div className="mb-3">
          <h1 className="text-2xl font-bold text-white">
            Jogos para você dar palpite
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Escolha o placar e acompanhe sua pontuação
          </p>
        </div>

        {/* Banner de ofensiva */}
        {streak >= 3 && (
          <div className="mb-4 bg-gradient-to-r from-orange-950/30 to-amber-950/30 border border-orange-500/30 rounded-lg p-3 flex items-center justify-between gap-3 animate-pulse">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-400" />
              <span className="text-sm text-orange-200 font-medium">
                🔥 Você está em uma ofensiva de{" "}
                <strong className="text-orange-300">{streak}</strong> acertos
                consecutivos!
              </span>
            </div>
            <Info size={16} className="text-orange-400/70" />
          </div>
        )}

        {/* Filtros de fase */}
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

        {/* Filtros de grupo */}
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

        {/* Campo de busca */}
        <div className="relative mb-4">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-zinc-500" />
          </div>
          <input
            type="text"
            placeholder="Buscar por time ou data (ex: Brasil, 15/06)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2 pl-10 pr-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-green-500 transition-colors"
          />
        </div>

        {/* Lista de jogos */}
        <div className="space-y-3">
          {visibleMatches.map((match) => {
            const locked = isLocked(match);
            const showEditMode = match.isEditing && !locked;
            const isFinalized = match.status === "finalizado";
            const showRealResult =
              isFinalized && match.goals_a !== null && match.goals_b !== null;
            const isBrazilGame =
              match.team_a === "Brasil" || match.team_b === "Brasil";

            return (
              <div
                key={match.id}
                className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden transition-all duration-200"
              >
                {isBrazilGame && (
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 via-yellow-400 to-blue-500"></div>
                )}
                <div className="text-zinc-500 text-xs font-medium w-full md:w-28 text-center md:text-left flex flex-col gap-1">
                  <span>
                    {new Date(match.match_date).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {match.grupo && (
                    <span className="text-zinc-600">Grupo {match.grupo}</span>
                  )}
                  {match.hasPoints && (
                    <div className="flex items-center gap-1 text-emerald-400 text-xs mt-1 justify-center md:justify-start">
                      <span>✓</span>
                      <span>+{match.points} pts</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-1 justify-center">
                  {/* Time A (esquerda) */}
                  <div className="flex items-center justify-end gap-1 w-20 md:w-24 min-w-0">
                    {match.team_a_logo && (
                      <img
                        src={match.team_a_logo}
                        alt={match.team_a}
                        className="w-5 h-5 md:w-6 md:h-6 object-contain flex-shrink-0"
                      />
                    )}
                    <button
                      onClick={() => toggleTeamName(match.id, "a")}
                      className={`font-bold text-base text-right hover:underline focus:outline-none ${expandedTeam[`${match.id}_a`] ? "break-words" : "truncate"}`}
                      title={match.team_a}
                    >
                      {match.team_a}
                    </button>
                  </div>

                  {/* Placar (já existente) */}
                  {!showEditMode ? (
                    <div className="flex items-center justify-center gap-3 bg-zinc-950 border border-zinc-800 px-6 py-2 rounded-lg">
                      <span
                        className={`text-2xl font-bold ${match.guess_a !== "" ? "text-green-500" : "text-zinc-700"}`}
                      >
                        {match.guess_a !== "" ? match.guess_a : "-"}
                      </span>
                      <span className="text-zinc-600 font-bold text-sm">X</span>
                      <span
                        className={`text-2xl font-bold ${match.guess_b !== "" ? "text-green-500" : "text-zinc-700"}`}
                      >
                        {match.guess_b !== "" ? match.guess_b : "-"}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={match.guess_a}
                        onChange={(e) =>
                          handleGuessChange(match.id, "guess_a", e.target.value)
                        }
                        className="w-12 h-12 text-center bg-zinc-950 border border-zinc-700 rounded-lg text-xl font-bold focus:outline-none focus:border-green-500"
                      />
                      <span className="text-zinc-600 font-bold text-sm">X</span>
                      <input
                        type="number"
                        min="0"
                        value={match.guess_b}
                        onChange={(e) =>
                          handleGuessChange(match.id, "guess_b", e.target.value)
                        }
                        className="w-12 h-12 text-center bg-zinc-950 border border-zinc-700 rounded-lg text-xl font-bold focus:outline-none focus:border-green-500"
                      />
                    </div>
                  )}

                  {/* Time B (direita) */}
                  <div className="flex items-center justify-start gap-1 w-20 md:w-24 min-w-0">
                    <button
                      onClick={() => toggleTeamName(match.id, "b")}
                      className={`font-bold text-base text-left hover:underline focus:outline-none ${expandedTeam[`${match.id}_b`] ? "break-words" : "truncate"}`}
                      title={match.team_b}
                    >
                      {match.team_b}
                    </button>
                    {match.team_b_logo && (
                      <img
                        src={match.team_b_logo}
                        alt={match.team_b}
                        className="w-5 h-5 md:w-6 md:h-6 object-contain flex-shrink-0"
                      />
                    )}
                  </div>
                </div>

                <div className="w-full md:w-auto">
                  {locked ? (
                    <button
                      disabled
                      className="bg-zinc-800/50 text-zinc-400 font-medium py-2 px-6 rounded-lg w-full md:w-auto text-sm cursor-not-allowed border border-zinc-700/30"
                    >
                      Bloqueado
                    </button>
                  ) : !match.isEditing ? (
                    <button
                      onClick={() => toggleEdit(match.id)}
                      className="bg-zinc-800 text-zinc-300 font-bold py-2 px-6 rounded-lg hover:bg-zinc-700 w-full md:w-auto transition-all text-sm"
                    >
                      Editar
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setPendingSaveMatch(match);
                        setShowConfirmModal(true);
                      }}
                      disabled={savingId === match.id}
                      className={`font-bold py-2 px-6 rounded-lg w-full md:w-auto transition-all text-sm flex items-center justify-center gap-1.5 ${
                        savedId === match.id
                          ? "bg-green-500 text-white"
                          : savingId === match.id
                            ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                            : "bg-white text-zinc-950 hover:bg-green-400"
                      }`}
                    >
                      {savedId === match.id ? (
                        <>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Salvo!
                        </>
                      ) : savingId === match.id ? (
                        "..."
                      ) : (
                        "Salvar"
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {visibleMatches.length === 0 && (
            <div className="text-center py-12 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
              <p className="text-zinc-500 font-medium">
                Nenhum jogo encontrado com os filtros atuais.
              </p>
            </div>
          )}

          {/* Botão "Carregar mais" */}
          {hasMore && (
            <div className="flex justify-center py-4">
              <button
                onClick={loadMore}
                className="bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors text-sm"
              >
                Carregar mais 10 jogos
              </button>
            </div>
          )}

          {/* Indicador de total carregado */}
          {filteredMatches.length > ITEMS_PER_PAGE && (
            <div className="text-center text-xs text-zinc-500 pt-2">
              Mostrando {visibleMatches.length} de {filteredMatches.length}{" "}
              jogos
            </div>
          )}
        </div>
      </div>

      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 bg-zinc-800 hover:bg-zinc-700 text-white p-3 rounded-full shadow-lg transition-all duration-200 z-50"
        >
          <ArrowUp size={20} />
        </button>
      )}

      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={() => {
          setShowConfirmModal(false);
          if (pendingSaveMatch) saveGuess(pendingSaveMatch);
        }}
        title="Confirmar palpite"
        message="Tem certeza que deseja salvar este palpite?"
      />
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() =>
          setAlertModal({ isOpen: false, message: "", type: "error" })
        }
        message={alertModal.message}
        type={alertModal.type}
      />
    </div>
  );
}
