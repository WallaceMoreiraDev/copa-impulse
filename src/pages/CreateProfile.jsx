import { useState } from "react";
import { supabase } from "../supabase";

export default function CreateProfile({ session, onProfileCreated }) {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSaveUsername = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    // Garantir que o full_name existe (fallback)
    const fullName = session.user.user_metadata?.full_name || "Usuário";

    const { error } = await supabase.from("profiles").upsert(
      {
        id: session.user.id,
        username: username,
        full_name: fullName,
        active: true,
        username_updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    if (error) {
      console.error("Erro ao salvar perfil:", error);
      setMessage(
        "Erro ao salvar seu apelido. O nome pode já estar em uso ou o perfil não pôde ser criado.",
      );
    } else {
      onProfileCreated(); // redireciona para dashboard
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 font-sans">
      <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md text-center border border-zinc-200">
        <h2 className="text-2xl font-bold text-zinc-800 mb-2">Falta pouco!</h2>
        <p className="text-zinc-500 mb-6 font-medium">
          Crie seu apelido único para o ranking
        </p>
        <form onSubmit={handleSaveUsername} className="flex flex-col gap-4">
          <input
            type="text"
            required
            value={username}
            onChange={(e) =>
              setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))
            }
            placeholder="ex: wallace_silva"
            className="w-full border border-zinc-300 px-4 py-3 rounded-xl text-zinc-800 focus:ring-2 focus:ring-zinc-800 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-3 px-4 rounded-xl shadow-sm transition-colors duration-200"
          >
            {loading ? "Salvando..." : "Salvar Apelido"}
          </button>
        </form>
        {message && (
          <div className="mt-4 text-red-600 text-sm font-medium">{message}</div>
        )}
      </div>
    </div>
  );
}
