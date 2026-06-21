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
  Settings,
  User,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { ConfirmationModal, AlertModal } from "../components/Modal";

const PHASES = [
  "Fase de Grupos",
  "16-avos de Final",
  "Oitavas de Final",
  "Quartas de Final",
  "Semifinal",
  "Final",
];

const ITEMS_PER_PAGE = 10;

// Configuração do cache (10 minutos)
const CACHE_EXPIRY_MS = 10 * 60 * 1000;
const CACHE_KEY_PREFIX = "dashboard_cache_";

// Funções auxiliares de cache
const getCacheKey = (userId) => `${CACHE_KEY_PREFIX}${userId}`;

const getCachedData = (userId) => {
  if (!userId) return null;
  const cacheKey = getCacheKey(userId);
  const cached = localStorage.getItem(cacheKey);
  if (!cached) return null;
  try {
    const { data, timestamp, streak } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_EXPIRY_MS) {
      return { data, streak };
    }
    localStorage.removeItem(cacheKey);
    return null;
  } catch {
    return null;
  }
};

const setCachedData = (userId, data, streak) => {
  if (!userId) return;
  const cacheKey = getCacheKey(userId);
  const cachePayload = {
    data,
    streak,
    timestamp: Date.now(),
  };
  localStorage.setItem(cacheKey, JSON.stringify(cachePayload));
};

const clearCache = (userId) => {
  if (!userId) return;
  const cacheKey = getCacheKey(userId);
  localStorage.removeItem(cacheKey);
};

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
  const [expandedTeam, setExpandedTeam] = useState({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [newNickname, setNewNickname] = useState("");
  const [nicknameError, setNicknameError] = useState("");
  const [nicknameSuccess, setNicknameSuccess] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [searchTerm, setSearchTerm] = useState("");

  // Estado para controlar quais fases eliminatórias estão completas (todos times definidos)
  const [phasesReady, setPhasesReady] = useState({
    "16-avos de Final": false,
    "Oitavas de Final": false,
    "Quartas de Final": false,
    Semifinal: false,
    Final: false,
  });

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, []);

  // Sempre que allMatches mudar, recalcular quais fases eliminatórias estão completas
  useEffect(() => {
    const knockoutPhases = [
      "16-avos de Final",
      "Oitavas de Final",
      "Quartas de Final",
      "Semifinal",
      "Final",
    ];
    const ready = { ...phasesReady };
    for (const fase of knockoutPhases) {
      const jogosDaFase = allMatches.filter((m) => m.fase === fase);
      if (jogosDaFase.length === 0) {
        ready[fase] = false;
      } else {
        // Verifica se todos os jogos da fase têm times definidos (team_a e team_b não vazios)
        const allDefined = jogosDaFase.every(
          (m) =>
            m.team_a &&
            m.team_a.trim() !== "" &&
            m.team_b &&
            m.team_b.trim() !== "",
        );
        ready[fase] = allDefined;
      }
    }
    setPhasesReady(ready);
  }, [allMatches]);

  const loadDashboard = async (forceRefresh = false) => {
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

      // Tentar usar cache (apenas se não for forceRefresh)
      let mergedData = null;
      let cachedStreak = null;
      if (!forceRefresh) {
        const cached = getCachedData(uid);
        if (cached && cached.data) {
          mergedData = cached.data;
          cachedStreak = cached.streak;
        }
      }

      if (mergedData) {
        setAllMatches(mergedData);
        if (cachedStreak !== null) setStreak(cachedStreak);
        setLoading(false);
        return;
      }

      // Buscar dados do Supabase - selecionando apenas colunas necessárias
      const { data: matchesData, error: matchesError } = await supabase
        .from("matches")
        .select(
          "id, team_a, team_b, match_date, fase, grupo, status, goals_a, goals_b, team_a_logo, team_b_logo",
        )
        .order("match_date", { ascending: true });

      if (matchesError) throw new Error(matchesError.message);

      const { data: guessesData, error: guessesError } = await supabase
        .from("guesses")
        .select("id, guess_a, guess_b, user_id, match_id, points_earned")
        .eq("user_id", uid);

      if (guessesError) throw new Error(guessesError.message);

      const merged = (matchesData || []).map((m) => {
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
      setAllMatches(merged);
      await calculateStreak(uid);
      // Armazenar no cache
      setCachedData(uid, merged, streak);
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
        return 0;
      }

      const matchIds = guesses.map((g) => g.match_id);
      const { data: matches, error: matchesError } = await supabase
        .from("matches")
        .select("id, match_date, status")
        .in("id", matchIds)
        .eq("status", "finalizado");

      if (matchesError || !matches) {
        setStreak(0);
        return 0;
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
      return currentStreak;
    } catch (err) {
      console.error(err);
      setStreak(0);
      return 0;
    }
  };

  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("username, username_updated_at")
      .eq("id", userId)
      .single();
    if (error) throw error;
    return data;
  };

  const canChangeNickname = (lastUpdatedAt) => {
    if (!lastUpdatedAt) return true;
    const last = new Date(lastUpdatedAt);
    const now = new Date();
    const diffDays = (now - last) / (1000 * 60 * 60 * 24);
    return diffDays >= 7;
  };

  const handleChangeNickname = async () => {
    if (!newNickname.trim()) {
      setNicknameError("Digite um apelido válido.");
      return;
    }
    const nickname = newNickname.trim().toLowerCase().replace(/\s/g, "_");

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", nickname)
      .maybeSingle();
    if (existing) {
      setNicknameError("Este apelido já está em uso.");
      return;
    }

    try {
      const profile = await fetchProfile();
      if (!canChangeNickname(profile.username_updated_at)) {
        const nextDate = new Date(profile.username_updated_at);
        nextDate.setDate(nextDate.getDate() + 7);
        setNicknameError(
          `Você só pode trocar o apelido uma vez por semana. Próxima alteração permitida a partir de ${nextDate.toLocaleDateString("pt-BR")}.`,
        );
        return;
      }
    } catch (err) {
      setNicknameError("Erro ao buscar dados do perfil.");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        username: nickname,
        username_updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    if (error) {
      setNicknameError("Erro ao atualizar apelido. Tente novamente.");
    } else {
      setNicknameSuccess("Apelido alterado com sucesso!");
      setNewNickname("");
      setTimeout(() => {
        setNicknameSuccess("");
        setShowSettingsModal(false);
      }, 2000);
      clearCache(userId);
      loadDashboard(true);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETAR CONTA") {
      setNicknameError("Digite exatamente 'DELETAR CONTA' para confirmar.");
      return;
    }
    setDeletingAccount(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ active: false, username: null })
        .eq("id", userId);
      if (error) throw error;
      clearCache(userId);
      await supabase.auth.signOut();
      window.location.href = "/?account_deleted=true";
    } catch (err) {
      console.error(err);
      setNicknameError(`Erro ao desativar conta: ${err.message}`);
      setDeletingAccount(false);
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
      // Invalida o cache pois os palpites mudaram
      clearCache(userId);
      // Recarrega os dados (forçando refresh)
      await loadDashboard(true);
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

    // Para fases eliminatórias, verificar se a fase está completa
    const knockoutPhases = [
      "16-avos de Final",
      "Oitavas de Final",
      "Quartas de Final",
      "Semifinal",
      "Final",
    ];
    if (knockoutPhases.includes(match.fase)) {
      if (!phasesReady[match.fase]) {
        return true; // bloqueia enquanto nem todos os jogos da fase estão definidos
      }
    }

    // Regra original dos 30 minutos antes do jogo
    const matchTime = new Date(match.match_date).getTime();
    const now = new Date().getTime();
    const diffMinutes = (matchTime - now) / (1000 * 60);
    return diffMinutes <= 30;
  };

  const matchesByPhaseGroup = useMemo(() => {
    let filtered = allMatches.filter((m) => m.fase === activePhase);
    if (activePhase === "Fase de Grupos" && activeGroup !== "Todos") {
      filtered = filtered.filter((m) => m.grupo === activeGroup);
    }
    return filtered;
  }, [allMatches, activePhase, activeGroup]);

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
            onClick={() => loadDashboard(true)}
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
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-4">
          <div className="flex justify-between items-center w-full md:w-auto">
            <img
              src="/logo5.png"
              alt="impulse"
              className="h-8 md:h-10 object-contain"
            />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden bg-zinc-800 p-2 rounded-lg"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          <div className="hidden md:flex flex-wrap justify-end gap-1">
            <button
              onClick={() => (window.location.href = "/ranking")}
              className="bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-1.5 px-3 rounded text-xs flex items-center gap-1"
            >
              <Trophy className="w-3.5 h-3.5" /> Ranking
            </button>
            <button
              onClick={() => (window.location.href = "/previsoes")}
              className="bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-1.5 px-3 rounded text-xs flex items-center gap-1"
            >
              <Users className="w-3.5 h-3.5" /> Previsões
            </button>
            <button
              onClick={() => (window.location.href = "/stats")}
              className="bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-1.5 px-3 rounded text-xs flex items-center gap-1"
            >
              <BarChart2 className="w-3.5 h-3.5" /> Estatísticas
            </button>
            <button
              onClick={() => (window.location.href = "/brasil")}
              className="bg-gradient-to-r from-green-600/80 via-yellow-500/80 to-blue-600/80 hover:from-green-600 hover:via-yellow-500 hover:to-blue-600 text-white font-medium py-1.5 px-3 rounded text-xs flex items-center gap-1"
            >
              <Flag className="w-3.5 h-3.5" /> Brasil
            </button>
            <button
              onClick={() => setShowSettingsModal(true)}
              className="bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-1.5 px-3 rounded text-xs flex items-center gap-1"
            >
              <Settings className="w-3.5 h-3.5" /> Configurações
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-red-400 hover:text-red-300 text-xs px-2 py-1.5"
            >
              Sair
            </button>
          </div>

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
                onClick={() => setShowSettingsModal(true)}
                className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 px-3 md:px-4 rounded text-xs md:text-sm flex items-center gap-1 md:gap-2"
              >
                <Settings className="w-4 h-4" />
                <span>Configurações</span>
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

        <div className="mb-4 bg-zinc-800/40 border border-zinc-700 rounded-lg p-3 flex items-start gap-3 text-sm">
          <Info size={18} className="text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="text-zinc-300">
            📡 Os resultados são atualizados automaticamente, mas podem levar
            alguns minutos após o fim da partida.
            <br />
            Caso note alguma inconsistência, o administrador irá corrigir o mais
            breve possível.
          </div>
        </div>

        <div className="flex items-center justify-between pb-7">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Jogos para você dar palpite
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              Escolha o placar e acompanhe sua pontuação
            </p>
          </div>
          <button
            onClick={() => setShowRulesModal(true)}
            className="text-zinc-400 hover:text-white transition-colors"
            title="Ver regras de pontuação"
          >
            <Info size={20} />
          </button>
        </div>

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

        <div className="space-y-3">
          {visibleMatches.map((match) => {
            const locked = isLocked(match);
            const showEditMode = match.isEditing && !locked;
            const isBrazilGame =
              match.team_a === "Brasil" || match.team_b === "Brasil";

            // Determinar mensagem de bloqueio específica para fase eliminatória incompleta
            const isKnockoutIncomplete =
              [
                "Oitavas de Final",
                "Quartas de Final",
                "Semifinal",
                "Final",
              ].includes(match.fase) && !phasesReady[match.fase];

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
                      {isKnockoutIncomplete
                        ? "Aguardando definição de todos os confrontos"
                        : "Bloqueado"}
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
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl max-w-md w-full p-6 border border-zinc-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">
                Configurações da conta
              </h2>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-zinc-300 mb-1">
                Alterar apelido
              </label>
              <input
                type="text"
                value={newNickname}
                onChange={(e) => setNewNickname(e.target.value)}
                placeholder="Novo apelido (ex: joao_silva)"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white"
              />
              {nicknameError && (
                <p className="text-red-400 text-xs mt-1">{nicknameError}</p>
              )}
              {nicknameSuccess && (
                <p className="text-green-400 text-xs mt-1">{nicknameSuccess}</p>
              )}
              <button
                onClick={handleChangeNickname}
                className="mt-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-1 px-3 rounded text-sm"
              >
                Salvar novo apelido
              </button>
              <p className="text-zinc-500 text-xs mt-2">
                Você pode alterar seu apelido apenas 1 vez por semana.
              </p>
            </div>

            <div className="border-t border-zinc-800 pt-4">
              <h3 className="text-lg font-semibold text-red-400 mb-2">
                Zona perigosa
              </h3>
              <p className="text-zinc-400 text-sm mb-3">
                A exclusão da conta é irreversível. Todos os seus palpites serão
                perdidos.
              </p>
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  setShowDeleteModal(true);
                }}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-1 px-3 rounded text-sm flex items-center gap-1"
              >
                <Trash2 size={14} /> Excluir minha conta
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl max-w-md w-full p-6 border border-zinc-700">
            <div className="flex items-center gap-2 mb-3 text-red-400">
              <AlertTriangle size={24} />
              <h2 className="text-xl font-bold">
                Excluir conta permanentemente
              </h2>
            </div>
            <p className="text-zinc-300 mb-4">
              Esta ação não pode ser desfeita. Todos os seus palpites e dados
              serão removidos.
            </p>
            <p className="text-zinc-400 text-sm mb-2">
              Digite <strong className="text-red-400">DELETAR CONTA</strong>{" "}
              para confirmar:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETAR CONTA"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded bg-zinc-700 hover:bg-zinc-600 text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
                className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                {deletingAccount ? "Excluindo..." : "Sim, excluir minha conta"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRulesModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl max-w-md w-full p-6 border border-zinc-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">
                Regras de Pontuação
              </h2>
              <button
                onClick={() => setShowRulesModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3 text-sm text-zinc-300">
              <p>
                <strong className="text-green-400">🎯 Placar exato:</strong> 100
                pontos + 10 por cada time com gol acertado (máx 120)
              </p>
              <p>
                <strong className="text-green-400">
                  🏆 Acertou o vencedor/empate (sem placar exato):
                </strong>{" "}
                50 pontos + 10 por cada gol acertado (máx 70)
              </p>
              <p>
                <strong className="text-green-400">
                  ⚽ Acertou gol(s) de um ou dois times (mas errou o vencedor):
                </strong>{" "}
                10 ou 20 pontos
              </p>
              <p>
                <strong className="text-red-400">❌ Errou tudo:</strong> 0
                pontos
              </p>
              <p className="text-xs text-zinc-500 mt-2">
                Exemplo: jogo real 3x1 → palpite 3x2 → acertou o vencedor e o
                gol do Brasil (3) → 50 + 10 = 60 pontos
              </p>
            </div>
            <button
              onClick={() => setShowRulesModal(false)}
              className="mt-6 w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
