import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const deactivated = urlParams.get("deactivated");
    if (deactivated === "true") {
      setMessage(
        "Sua conta foi desativada. Entre em contato com o administrador.",
      );
    }
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error)
      setMessage("Ocorreu um erro ao tentar conectar. Tente novamente.");
    setLoading(false);
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat flex items-center justify-center p-4 font-sans text-zinc-100"
      style={{ backgroundImage: "url('/bg-brasil.png')" }}
    >
      {/* Overlay escuro para contraste */}
      <div className="absolute inset-0 bg-black/60"></div>

      {/* Card de login (relativo para ficar acima do overlay) */}
      <div className="relative z-10 bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md text-center border border-zinc-200">
        <div className="mb-3 flex justify-center">
          <img
            src="/impulse.png"
            alt="Logo do impulse"
            className="h-28 object-contain mb-2"
            onError={(e) => {
              e.target.style.display = "none";
              e.target.nextSibling.style.display = "block";
            }}
          />
          <h1
            style={{ display: "none" }}
            className="text-4xl font-extrabold tracking-tighter text-zinc-900"
          >
            in<span className="text-green-500">pulse</span>
          </h1>
        </div>

        <h2 className="text-xl font-bold mb-2 text-zinc-800">
          Copa no
          <span className="text-blue-700"> I</span>
          <span className="text-yellow-500">m</span>
          <span className="text-green-600">p</span>
          ulse
        </h2>
        <p className="text-zinc-500 mb-5 font-medium">
          Faça login para registrar seus palpites
        </p>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-900 font-bold py-3 px-4 rounded-xl shadow-sm transition-all duration-200 flex items-center justify-center gap-3"
        >
          <img
            src="https://www.svgrepo.com/show/475656/google-color.svg"
            className="w-6 h-6"
            alt="Google"
          />
          {loading ? "Conectando..." : "Entrar com Google"}
        </button>

        {message && (
          <div className="mt-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-600 font-medium text-sm">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
