import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { ConfirmationModal, AlertModal } from "../components/Modal";
import {
  ArrowLeft,
  RefreshCw,
  Users,
  Calendar,
  CheckCircle,
  PlusCircle,
  Trash2,
  Save,
  X,
  AlertTriangle,
  Upload,
  ChevronDown,
} from "lucide-react";

// Componente Dropdown simples
function Dropdown({ label, icon: Icon, children }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold flex items-center gap-1"
      >
        {Icon && <Icon size={14} />}
        {label}
        <ChevronDown size={12} className="ml-1" />
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg z-10">
          <div className="py-1">{children}</div>
        </div>
      )}
    </div>
  );
}

function DropdownItem({ onClick, icon: Icon, children }) {
  return (
    <button
      onClick={() => {
        onClick();
      }}
      className="w-full text-left px-4 py-2 text-sm text-white hover:bg-zinc-700 flex items-center gap-2"
    >
      {Icon && <Icon size={14} />}
      {children}
    </button>
  );
}

export default function AdminPanel() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [message, setMessage] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [stats, setStats] = useState({
    totalMatches: 0,
    finishedMatches: 0,
    totalUsers: 0,
  });
  const [newMatch, setNewMatch] = useState({
    team_a: "",
    team_b: "",
    match_date: "",
    fase: "Fase de Grupos",
    grupo: "",
    status: "pendente",
    goals_a: null,
    goals_b: null,
  });
  const [creating, setCreating] = useState(false);
  const [showRecalcConfirm, setShowRecalcConfirm] = useState(false);
  const [recalcAlert, setRecalcAlert] = useState({
    isOpen: false,
    message: "",
    type: "error",
  });
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [bulkData, setBulkData] = useState("");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    checkAdminAndLoad();
  }, []);

  const checkAdminAndLoad = async () => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        setIsAdmin(false);
        setChecking(false);
        return;
      }
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();
      if (profileError || !profile?.is_admin) {
        setIsAdmin(false);
        setChecking(false);
        return;
      }
      setIsAdmin(true);
      await loadMatches();
      await loadStats();
    } catch (err) {
      console.error(err);
      setIsAdmin(false);
    } finally {
      setChecking(false);
    }
  };

  const loadStats = async () => {
    const { count: totalMatches } = await supabase
      .from("matches")
      .select("*", { count: "exact", head: true });
    const { count: finishedMatches } = await supabase
      .from("matches")
      .select("*", { count: "exact", head: true })
      .eq("status", "finalizado");
    const { count: totalUsers } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });
    setStats({
      totalMatches: totalMatches || 0,
      finishedMatches: finishedMatches || 0,
      totalUsers: totalUsers || 0,
    });
  };

  const loadMatches = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .order("match_date", { ascending: true });
    if (error) {
      setMessage("Erro ao carregar jogos.");
    } else {
      setMatches(data || []);
    }
    setLoading(false);
  };

  const handleSave = async (match) => {
    setSaving(match.id);
    setMessage("");

    const { error: updateError } = await supabase
      .from("matches")
      .update({
        goals_a: match.goals_a,
        goals_b: match.goals_b,
        status: match.status,
      })
      .eq("id", match.id);

    if (updateError) {
      setMessage(`Erro ao salvar placar: ${updateError.message}`);
      setSaving(null);
      return;
    }

    // Só recalcula pontos se o jogo estiver finalizado (ou se já estava finalizado e o placar foi alterado)
    if (match.status === "finalizado") {
      const { error: rpcError } = await supabase.rpc("atualizar_pontos_jogo", {
        p_match_id: match.id,
      });
      if (rpcError) {
        setMessage(`Erro ao recalcular pontos: ${rpcError.message}`);
      } else {
        setMessage(`Placar e pontos atualizados com sucesso!`);
      }
    } else {
      setMessage(
        `Jogo salvo como "${match.status}". Os pontos só serão calculados quando o status for alterado para "finalizado".`,
      );
    }

    await loadStats();
    await loadMatches();
    setSaving(null);
  };

  const handleRecalcAllPoints = async () => {
    setMessage("Recalculando pontos...");
    const { data: finishedMatches } = await supabase
      .from("matches")
      .select("id")
      .eq("status", "finalizado");
    if (!finishedMatches) return;
    for (const match of finishedMatches) {
      await supabase.rpc("atualizar_pontos_jogo", { p_match_id: match.id });
    }
    setMessage("Pontos recalculados com sucesso!");
    await loadStats();
    setShowRecalcConfirm(false);
    setRecalcAlert({
      isOpen: true,
      message: "Pontos recalculados com sucesso!",
      type: "success",
    });
  };

  const handleChange = (matchId, field, value) => {
    setMatches((prev) =>
      prev.map((m) =>
        m.id === matchId
          ? {
              ...m,
              [field]:
                field === "status"
                  ? value
                  : value === ""
                    ? null
                    : parseInt(value) || 0,
            }
          : m,
      ),
    );
  };

  const handleCreateMatch = async (e) => {
    e.preventDefault();
    setCreating(true);
    setMessage("");
    if (!newMatch.team_a || !newMatch.team_b || !newMatch.match_date) {
      setMessage("Preencha times e data/hora.");
      setCreating(false);
      return;
    }
    const matchToInsert = {
      team_a: newMatch.team_a,
      team_b: newMatch.team_b,
      match_date: newMatch.match_date,
      fase: newMatch.fase,
      grupo: newMatch.grupo ? newMatch.grupo.toUpperCase() : null,
      status: newMatch.status,
      goals_a: newMatch.goals_a ?? null,
      goals_b: newMatch.goals_b ?? null,
    };
    const { error } = await supabase.from("matches").insert([matchToInsert]);
    if (error) {
      console.error(error);
      setMessage(`Erro ao criar jogo: ${error.message}`);
    } else {
      setMessage("Jogo criado com sucesso!");
      setShowCreateModal(false);
      setNewMatch({
        team_a: "",
        team_b: "",
        match_date: "",
        fase: "Fase de Grupos",
        grupo: "",
        status: "pendente",
        goals_a: null,
        goals_b: null,
      });
      await loadMatches();
      await loadStats();
    }
    setCreating(false);
  };

  const handleDeleteMatch = async (matchId) => {
    setDeleting(matchId);
    setMessage("");
    try {
      const { error: matchError } = await supabase
        .from("matches")
        .delete()
        .eq("id", matchId);
      if (matchError)
        throw new Error(`Erro ao remover jogo: ${matchError.message}`);
      setMessage("Jogo removido com sucesso!");
      setShowDeleteConfirm(null);
      await loadMatches();
      await loadStats();
    } catch (err) {
      console.error(err);
      setMessage(err.message);
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteAllMatches = async () => {
    setDeletingAll(true);
    setMessage("");
    try {
      // 1. Deletar todos os jogos (e palpites via ON DELETE CASCADE)
      const { error: matchesError } = await supabase
        .from("matches")
        .delete()
        .neq("id", 0);
      if (matchesError)
        throw new Error(`Erro ao remover jogos: ${matchesError.message}`);

      // 2. Resetar os pontos de todos os usuários
      const { error: resetError } = await supabase
        .from("profiles")
        .update({ total_points: 0, exatos_count: 0 })
        .neq("id", "00000000-0000-0000-0000-000000000000"); // atualiza todos
      if (resetError) {
        console.error("Erro ao resetar pontos:", resetError);
        setMessage("Jogos removidos, mas houve erro ao resetar os pontos.");
      } else {
        setMessage(
          "Todos os jogos e palpites removidos, e pontos resetados com sucesso!",
        );
      }

      await loadMatches();
      await loadStats();
    } catch (err) {
      console.error(err);
      setMessage(err.message);
    } finally {
      setDeletingAll(false);
      setShowDeleteAllConfirm(false);
    }
  };

  const handleBulkImport = async () => {
    if (!bulkData.trim()) {
      setMessage("Por favor, cole os dados dos jogos.");
      return;
    }
    setImporting(true);
    setMessage("");
    const lines = bulkData.trim().split(/\r?\n/);
    // ignora cabeçalho se existir
    if (lines[0].toLowerCase().includes("time_a")) lines.shift();
    const matchesToInsert = [];
    const errors = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === "") continue;
      let parts;
      if (line.includes(";")) {
        parts = line.split(";").map((s) => s.trim());
      } else {
        parts = line.split(",").map((s) => s.trim());
      }
      if (parts.length < 4) {
        errors.push(
          `Linha ${i + 1}: poucas colunas (mínimo 4: time_a, time_b, data, fase)`,
        );
        continue;
      }
      const [
        team_a,
        team_b,
        match_date,
        fase,
        grupo = null,
        status = "pendente",
        goals_a = null,
        goals_b = null,
      ] = parts;
      if (!match_date.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)) {
        errors.push(
          `Linha ${i + 1}: data inválida (use formato YYYY-MM-DDTHH:MM)`,
        );
        continue;
      }
      matchesToInsert.push({
        team_a,
        team_b,
        match_date,
        fase,
        grupo: grupo && grupo !== "" ? grupo.toUpperCase() : null,
        status: ["pendente", "finalizado", "adiado"].includes(status)
          ? status
          : "pendente",
        goals_a:
          goals_a && !isNaN(parseInt(goals_a)) ? parseInt(goals_a) : null,
        goals_b:
          goals_b && !isNaN(parseInt(goals_b)) ? parseInt(goals_b) : null,
      });
    }
    if (errors.length > 0) {
      setMessage(`Erros encontrados:\n${errors.join("\n")}`);
      setImporting(false);
      return;
    }
    if (matchesToInsert.length === 0) {
      setMessage("Nenhum jogo válido para importar.");
      setImporting(false);
      return;
    }
    const { error } = await supabase.from("matches").insert(matchesToInsert);
    if (error) {
      setMessage(`Erro ao importar jogos: ${error.message}`);
    } else {
      setMessage(`${matchesToInsert.length} jogos importados com sucesso!`);
      setShowBulkImportModal(false);
      setBulkData("");
      await loadMatches();
      await loadStats();
    }
    setImporting(false);
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
        Verificando acesso...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-white p-4">
        <h1 className="text-2xl font-bold mb-2">Acesso negado</h1>
        <p className="text-zinc-400">
          Você não tem permissão para acessar esta área.
        </p>
        <button
          onClick={() => (window.location.href = "/dashboard")}
          className="mt-4 bg-green-600 px-4 py-2 rounded"
        >
          Voltar para o início
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
        Carregando jogos...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-6 font-sans text-zinc-100">
      <div className="max-w-6xl mx-auto">
        {/* Cabeçalho reformulado */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-white">
            Painel do Administrador
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => (window.location.href = "/dashboard")}
              className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-2 rounded-lg text-xs md:text-sm flex items-center gap-1"
            >
              <ArrowLeft size={14} /> Dashboard
            </button>

            <Dropdown label="Cadastrar" icon={PlusCircle}>
              <DropdownItem
                onClick={() => setShowCreateModal(true)}
                icon={PlusCircle}
              >
                Novo Jogo
              </DropdownItem>
              <DropdownItem
                onClick={() => setShowBulkImportModal(true)}
                icon={Upload}
              >
                Importar em Massa
              </DropdownItem>
            </Dropdown>

            <Dropdown label="Administração" icon={Users}>
              <DropdownItem
                onClick={() => (window.location.href = "/admin/users")}
                icon={Users}
              >
                Gerenciar Usuários
              </DropdownItem>
              <DropdownItem
                onClick={() => setShowRecalcConfirm(true)}
                icon={RefreshCw}
              >
                Recalcular Pontos
              </DropdownItem>
              <DropdownItem
                onClick={() => setShowDeleteAllConfirm(true)}
                icon={Trash2}
              >
                Excluir Todos os Jogos
              </DropdownItem>
            </Dropdown>

            <button
              onClick={async () => {
                setMessage("Importando jogos da Copa via football-data.org...");
                try {
                  const { data, error } = await supabase.functions.invoke(
                    "import-copa",
                    { method: "POST" },
                  );
                  if (error) throw error;
                  setMessage(
                    `${data.count} jogos importados/atualizados com sucesso!`,
                  );
                  await loadMatches();
                  await loadStats();
                } catch (err) {
                  console.error(err);
                  setMessage(`Erro: ${err.message}`);
                }
              }}
              className="bg-purple-600 hover:bg-purple-700 px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold flex items-center gap-1"
            >
              <Calendar size={14} /> Importar da football-data
            </button>

            <button
              onClick={() => supabase.auth.signOut()}
              className="text-red-400 hover:text-red-300 text-xs md:text-sm px-2"
            >
              Sair
            </button>
          </div>
        </div>

        {/* Cards de estatísticas (mantido igual) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
            <Calendar className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-zinc-400 text-sm">Total de Jogos</p>
              <p className="text-2xl font-bold text-white">
                {stats.totalMatches}
              </p>
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-zinc-400 text-sm">Jogos Finalizados</p>
              <p className="text-2xl font-bold text-white">
                {stats.finishedMatches}
              </p>
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
            <Users className="w-8 h-8 text-yellow-500" />
            <div>
              <p className="text-zinc-400 text-sm">Participantes</p>
              <p className="text-2xl font-bold text-white">
                {stats.totalUsers}
              </p>
            </div>
          </div>
        </div>

        {message && (
          <div
            className={`mb-4 p-3 rounded-lg whitespace-pre-wrap ${
              message.includes("sucesso") || message.includes("importados")
                ? "bg-green-900/50 text-green-300"
                : "bg-red-900/50 text-red-300"
            }`}
          >
            {message}
          </div>
        )}

        {/* Tabela de jogos (mesma do original) */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-zinc-800 rounded-lg">
            <thead className="bg-zinc-900">
              <tr>
                <th className="p-2 md:p-3 text-left">Data</th>
                <th className="p-2 md:p-3 text-left">Fase</th>
                <th className="p-2 md:p-3 text-left">Jogo</th>
                <th className="p-2 md:p-3 text-center">Placar real</th>
                <th className="p-2 md:p-3 text-center">Status</th>
                <th className="p-2 md:p-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((match) => (
                <tr
                  key={match.id}
                  className="border-t border-zinc-800 hover:bg-zinc-900/50"
                >
                  <td className="p-2 md:p-3 whitespace-nowrap">
                    {new Date(match.match_date).toLocaleDateString("pt-BR")}
                    <br />
                    <span className="text-xs text-zinc-500">
                      {new Date(match.match_date).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </td>
                  <td className="p-2 md:p-3">
                    {match.fase}
                    {match.grupo && (
                      <div className="text-xs text-zinc-500">
                        Grupo {match.grupo}
                      </div>
                    )}
                  </td>
                  <td className="p-2 md:p-3 font-medium">
                    {match.team_a} vs {match.team_b}
                  </td>
                  <td className="p-2 md:p-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={match.goals_a ?? ""}
                        onChange={(e) =>
                          handleChange(match.id, "goals_a", e.target.value)
                        }
                        className="w-14 text-center bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white"
                      />
                      <span>×</span>
                      <input
                        type="number"
                        min="0"
                        value={match.goals_b ?? ""}
                        onChange={(e) =>
                          handleChange(match.id, "goals_b", e.target.value)
                        }
                        className="w-14 text-center bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white"
                      />
                    </div>
                  </td>
                  <td className="p-2 md:p-3 text-center">
                    <select
                      value={match.status}
                      onChange={(e) =>
                        handleChange(match.id, "status", e.target.value)
                      }
                      className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm"
                    >
                      <option value="pendente">Pendente</option>
                      <option value="finalizado">Finalizado</option>
                      <option value="adiado">Adiado</option>
                    </select>
                  </td>
                  <td className="p-2 md:p-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleSave(match)}
                        disabled={saving === match.id}
                        className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 px-3 py-1 rounded text-sm font-semibold flex items-center gap-1"
                      >
                        <Save size={14} />
                        {saving === match.id ? "..." : "Salvar"}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(match.id)}
                        disabled={deleting === match.id}
                        className="bg-red-700 hover:bg-red-800 disabled:bg-red-900 px-3 py-1 rounded text-sm font-semibold flex items-center gap-1"
                      >
                        <Trash2 size={14} />
                        {deleting === match.id ? "..." : ""}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {matches.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-zinc-500">
                    Nenhum jogo cadastrado. Clique em "Cadastrar" para
                    adicionar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modais (mantidos iguais) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl max-w-md w-full p-6 border border-zinc-700">
            <h2 className="text-xl font-bold mb-4 text-white">
              Criar novo jogo
            </h2>
            <form onSubmit={handleCreateMatch} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Time A"
                  value={newMatch.team_a}
                  onChange={(e) =>
                    setNewMatch({ ...newMatch, team_a: e.target.value })
                  }
                  className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
                  required
                />
                <input
                  type="text"
                  placeholder="Time B"
                  value={newMatch.team_b}
                  onChange={(e) =>
                    setNewMatch({ ...newMatch, team_b: e.target.value })
                  }
                  className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
                  required
                />
              </div>
              <input
                type="datetime-local"
                value={newMatch.match_date}
                onChange={(e) =>
                  setNewMatch({ ...newMatch, match_date: e.target.value })
                }
                className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white w-full"
                required
              />
              <select
                value={newMatch.fase}
                onChange={(e) =>
                  setNewMatch({ ...newMatch, fase: e.target.value })
                }
                className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white w-full"
              >
                <option>Fase de Grupos</option>
                <option>16-avos de Final</option>
                <option>Oitavas de Final</option>
                <option>Quartas de Final</option>
                <option>Semifinal</option>
                <option>Final</option>
              </select>
              <input
                type="text"
                placeholder="Grupo (ex: A, B) – opcional"
                value={newMatch.grupo}
                onChange={(e) =>
                  setNewMatch({ ...newMatch, grupo: e.target.value })
                }
                className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white w-full"
              />
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded bg-zinc-700 hover:bg-zinc-600 text-white flex items-center gap-1"
                >
                  <X size={14} /> Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 text-white font-semibold flex items-center gap-1"
                >
                  <PlusCircle size={14} />
                  {creating ? "Criando..." : "Criar Jogo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBulkImportModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl max-w-2xl w-full p-6 border border-zinc-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">
                Importar Jogos em Massa
              </h2>
              <button
                onClick={() => setShowBulkImportModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-zinc-400 text-sm mb-3">
              Cole os dados no formato CSV (separado por vírgulas ou
              ponto-e-vírgula). Cada linha deve conter os campos na ordem:
            </p>
            <pre className="bg-zinc-950 p-3 rounded text-xs text-zinc-300 mb-4 overflow-x-auto">
              time_a, time_b, match_date, fase, grupo, status, goals_a, goals_b
            </pre>
            <p className="text-zinc-500 text-xs mb-2">
              <strong>Exemplo:</strong>
            </p>
            <pre className="bg-zinc-950 p-3 rounded text-xs text-green-300 mb-4 overflow-x-auto">
              Brasil, Sérvia, 2026-06-14T15:00, Fase de Grupos, G, pendente, ,
              Suíça, Camarões, 2026-06-14T18:00, Fase de Grupos, G, pendente, ,
            </pre>
            <textarea
              value={bulkData}
              onChange={(e) => setBulkData(e.target.value)}
              rows={10}
              placeholder="Cole aqui os dados..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-sm text-white font-mono focus:outline-none focus:border-green-500"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowBulkImportModal(false)}
                className="px-4 py-2 rounded bg-zinc-700 hover:bg-zinc-600 text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkImport}
                disabled={importing}
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-2"
              >
                <Upload size={16} />
                {importing ? "Importando..." : "Importar Jogos"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl max-w-md w-full p-6 border border-zinc-700">
            <h2 className="text-xl font-bold mb-2 text-white">
              Confirmar exclusão
            </h2>
            <p className="text-zinc-300 mb-4">
              Tem certeza que deseja excluir este jogo? <br />
              <strong>
                Todos os palpites associados serão removidos automaticamente.
              </strong>
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 rounded bg-zinc-700 hover:bg-zinc-600 text-white"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteMatch(showDeleteConfirm)}
                disabled={deleting !== null}
                className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                {deleting === showDeleteConfirm
                  ? "Excluindo..."
                  : "Sim, excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={showRecalcConfirm}
        onClose={() => setShowRecalcConfirm(false)}
        onConfirm={handleRecalcAllPoints}
        title="Recalcular todos os pontos"
        message="ATENÇÃO: Isso vai recalcular os pontos de TODOS os jogos finalizados com base nas regras atuais. Continuar?"
      />
      <AlertModal
        isOpen={recalcAlert.isOpen}
        onClose={() =>
          setRecalcAlert({ isOpen: false, message: "", type: "error" })
        }
        message={recalcAlert.message}
        type={recalcAlert.type}
      />
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl max-w-md w-full p-6 border border-zinc-700">
            <div className="flex items-center gap-2 mb-3 text-red-400">
              <AlertTriangle size={24} />
              <h2 className="text-xl font-bold">Excluir TODOS os jogos</h2>
            </div>
            <p className="text-zinc-300 mb-4">
              <strong>ATENÇÃO:</strong> Isso vai remover todos os jogos e todos
              os palpites associados. Esta ação é irreversível.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteAllConfirm(false)}
                className="px-4 py-2 rounded bg-zinc-700 hover:bg-zinc-600 text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteAllMatches}
                disabled={deletingAll}
                className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                {deletingAll ? "Excluindo..." : "Sim, excluir tudo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
