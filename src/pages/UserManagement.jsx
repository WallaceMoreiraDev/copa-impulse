import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import {
  Users,
  Edit2,
  Save,
  X,
  RefreshCw,
  AlertCircle,
  ArrowLeft,
  Power,
  PowerOff,
} from "lucide-react";
import { ConfirmationModal, AlertModal } from "../components/Modal";

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editUsername, setEditUsername] = useState("");
  const [message, setMessage] = useState({ text: "", type: "" });
  const [showResetAllConfirm, setShowResetAllConfirm] = useState(false);

  // Modal states for confirmations
  const [resetUserId, setResetUserId] = useState(null);
  const [toggleUserId, setToggleUserId] = useState(null);
  const [toggleAction, setToggleAction] = useState({ active: false, name: "" });
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    message: "",
    type: "error",
  });

  useEffect(() => {
    checkAdminAndLoad();
  }, []);

  const checkAdminAndLoad = async () => {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error || !user) {
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
      await loadUsers();
    } catch (err) {
      console.error(err);
      setIsAdmin(false);
    } finally {
      setChecking(false);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, full_name, total_points, exatos_count, active")
      .order("username", { ascending: true });
    if (error) {
      setMessage({ text: "Erro ao carregar usuários", type: "error" });
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  const handleEdit = (user) => {
    setEditingId(user.id);
    setEditUsername(user.username || "");
  };

  const handleSaveEdit = async (userId) => {
    if (!editUsername.trim()) {
      setMessage({ text: "Apelido não pode estar vazio", type: "error" });
      return;
    }
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", editUsername.trim())
      .neq("id", userId)
      .maybeSingle();
    if (existing) {
      setMessage({ text: "Este apelido já está em uso", type: "error" });
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ username: editUsername.trim() })
      .eq("id", userId);
    if (error) {
      setMessage({ text: "Erro ao atualizar apelido", type: "error" });
    } else {
      setMessage({ text: "Apelido atualizado!", type: "success" });
      setEditingId(null);
      await loadUsers();
    }
  };

  const handleResetUserPoints = async (userId) => {
    const { error } = await supabase
      .from("profiles")
      .update({ total_points: 0, exatos_count: 0 })
      .eq("id", userId);
    if (error) {
      setAlertModal({
        isOpen: true,
        message: "Erro ao resetar pontos",
        type: "error",
      });
    } else {
      setAlertModal({
        isOpen: true,
        message: "Pontos resetados com sucesso!",
        type: "success",
      });
      await loadUsers();
    }
    setResetUserId(null);
  };

  const handleToggleActive = async (userId, currentActive, userName) => {
    const action = currentActive ? "desativar" : "reativar";
    const { error } = await supabase
      .from("profiles")
      .update({ active: !currentActive })
      .eq("id", userId);
    if (error) {
      setAlertModal({
        isOpen: true,
        message: `Erro ao ${action} usuário`,
        type: "error",
      });
    } else {
      setAlertModal({
        isOpen: true,
        message: `Usuário ${action}do com sucesso!`,
        type: "success",
      });
      await loadUsers();
    }
    setToggleUserId(null);
  };

  const handleResetAllPoints = async () => {
    const { error } = await supabase
      .from("profiles")
      .update({ total_points: 0, exatos_count: 0 })
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      setAlertModal({
        isOpen: true,
        message: "Erro ao resetar pontos de todos",
        type: "error",
      });
    } else {
      setAlertModal({
        isOpen: true,
        message: "Pontos de todos os usuários foram resetados!",
        type: "success",
      });
      await loadUsers();
    }
    setShowResetAllConfirm(false);
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
        Carregando...
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
          Voltar
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-6 font-sans text-zinc-100">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex items-center gap-3">
            <Users size={24} className="text-green-500" />
            <h1 className="text-xl md:text-2xl font-bold text-white">
              Gerenciar Usuários
            </h1>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={() => setShowResetAllConfirm(true)}
              className="bg-red-600/20 hover:bg-red-600/30 text-red-400 px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm flex items-center gap-1 border border-red-800/30"
            >
              <RefreshCw size={14} />
              <span>Resetar todos</span>
            </button>
            <button
              onClick={() => (window.location.href = "/admin")}
              className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm flex items-center gap-1"
            >
              <ArrowLeft size={14} />
              <span>Voltar</span>
            </button>
          </div>
        </div>

        {message.text && (
          <div
            className={`mb-4 p-3 rounded-lg ${message.type === "success" ? "bg-green-900/50 text-green-300" : "bg-red-900/50 text-red-300"}`}
          >
            {message.text}
          </div>
        )}

        <div className="overflow-x-auto bg-zinc-900 rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-800">
              <tr>
                <th className="p-2 md:p-3 text-left">Usuário</th>
                <th className="p-2 md:p-3 text-left">Apelido</th>
                <th className="p-2 md:p-3 text-center">Pontos</th>
                <th className="p-2 md:p-3 text-center">Acertos exatos</th>
                <th className="p-2 md:p-3 text-center">Status</th>
                <th className="p-2 md:p-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className={`border-t border-zinc-800 hover:bg-zinc-800/30 ${!user.active ? "opacity-60" : ""}`}
                >
                  <td className="p-2 md:p-3 font-medium">
                    {user.full_name || "—"}
                  </td>
                  <td className="p-2 md:p-3">
                    {editingId === user.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editUsername}
                          onChange={(e) =>
                            setEditUsername(
                              e.target.value.toLowerCase().replace(/\s/g, "_"),
                            )
                          }
                          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-sm"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveEdit(user.id)}
                          className="text-green-500 hover:text-green-400"
                        >
                          <Save size={16} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-zinc-500 hover:text-zinc-400"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span>{user.username || "—"}</span>
                        <button
                          onClick={() => handleEdit(user)}
                          className="text-zinc-500 hover:text-zinc-300"
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="p-2 md:p-3 text-center font-bold text-green-400">
                    {user.total_points}
                  </td>
                  <td className="p-2 md:p-3 text-center text-yellow-400">
                    {user.exatos_count}
                  </td>
                  <td className="p-2 md:p-3 text-center">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${user.active ? "bg-green-900/50 text-green-300" : "bg-red-900/50 text-red-300"}`}
                    >
                      {user.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="p-2 md:p-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setResetUserId(user.id)}
                        className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1"
                        title="Zerar pontos"
                      >
                        <RefreshCw size={14} />
                      </button>
                      <button
                        onClick={() => {
                          setToggleUserId(user.id);
                          setToggleAction({
                            active: user.active,
                            name: user.username || user.full_name,
                          });
                        }}
                        className={`text-xs flex items-center gap-1 ${user.active ? "text-orange-400 hover:text-orange-300" : "text-green-400 hover:text-green-300"}`}
                        title={
                          user.active ? "Desativar usuário" : "Reativar usuário"
                        }
                      >
                        {user.active ? (
                          <PowerOff size={14} />
                        ) : (
                          <Power size={14} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-zinc-500">
                    Nenhum usuário cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modais de confirmação */}
      {resetUserId !== null && (
        <ConfirmationModal
          isOpen={true}
          onClose={() => setResetUserId(null)}
          onConfirm={() => handleResetUserPoints(resetUserId)}
          title="Resetar pontos"
          message="Tem certeza que deseja zerar os pontos deste usuário?"
        />
      )}
      {toggleUserId !== null && (
        <ConfirmationModal
          isOpen={true}
          onClose={() => setToggleUserId(null)}
          onConfirm={() =>
            handleToggleActive(
              toggleUserId,
              toggleAction.active,
              toggleAction.name,
            )
          }
          title={toggleAction.active ? "Desativar usuário" : "Reativar usuário"}
          message={`Tem certeza que deseja ${toggleAction.active ? "desativar" : "reativar"} o usuário "${toggleAction.name}"?`}
        />
      )}
      {showResetAllConfirm && (
        <ConfirmationModal
          isOpen={true}
          onClose={() => setShowResetAllConfirm(false)}
          onConfirm={handleResetAllPoints}
          title="Resetar todos os pontos"
          message="ATENÇÃO: Isso vai zerar TODOS os pontos e acertos exatos de TODOS os usuários. Esta ação é irreversível. Os palpites permanecem, mas os pontos serão recalculados apenas quando novos resultados forem inseridos."
          confirmText="Sim, resetar todos"
        />
      )}
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
