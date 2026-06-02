import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import {
  BarChart2,
  TrendingUp,
  Award,
  Target,
  Users,
  ArrowLeft,
  Trophy,
} from "lucide-react";

export default function Stats() {
  const [stats, setStats] = useState({
    total_points: 0,
    exatos_count: 0,
    vencedores_count: 0,
    erros_count: 0,
    total_palpites: 0,
    ranking_position: null,
    total_users: 0,
  });
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = "/";
      return;
    }
    const uid = session.user.id;
    setUserId(uid);

    // Busca perfil do usuário
    const { data: profile } = await supabase
      .from("profiles")
      .select("total_points, exatos_count")
      .eq("id", uid)
      .single();

    // Busca todos os palpites do usuário com os resultados reais
    const { data: guessesData } = await supabase
      .from("guesses")
      .select(
        `
        points_earned,
        match:matches(goals_a, goals_b, status)
      `,
      )
      .eq("user_id", uid);

    let vencedores = 0;
    let erros = 0;
    let totalPalpites = 0;

    (guessesData || []).forEach((g) => {
      if (g.match && g.match.status === "finalizado") {
        totalPalpites++;
        if (g.points_earned === 5) {
          // exato já conta separadamente
        } else if (g.points_earned === 3) {
          vencedores++;
        } else if (g.points_earned === 0) {
          erros++;
        }
      }
    });

    // Busca posição no ranking
    const { data: ranking } = await supabase
      .from("profiles")
      .select("id, total_points, exatos_count")
      .order("total_points", { ascending: false })
      .order("exatos_count", { ascending: false });

    let position = null;
    if (ranking) {
      position = ranking.findIndex((p) => p.id === uid) + 1;
    }

    setStats({
      total_points: profile?.total_points || 0,
      exatos_count: profile?.exatos_count || 0,
      vencedores_count: vencedores,
      erros_count: erros,
      total_palpites: totalPalpites,
      ranking_position: position,
      total_users: ranking?.length || 0,
    });
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
        Carregando estatísticas...
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
        <div className="flex items-center justify-center sm:justify-start gap-2 mb-8">
          <BarChart2 className="w-6 h-6 text-green-500" />
          <h1 className="text-xl md:text-2xl font-bold text-white text-center sm:text-left">
            Minhas estatísticas
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pontuação total */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <Trophy className="w-8 h-8 text-yellow-500" />
              <span className="text-3xl font-bold text-green-400">
                {stats.total_points}
              </span>
            </div>
            <p className="text-zinc-400 text-sm">Pontuação total</p>
          </div>

          {/* Posição no ranking */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-8 h-8 text-blue-500" />
              <span className="text-3xl font-bold text-white">
                {stats.ranking_position ? `${stats.ranking_position}º` : "—"}
              </span>
            </div>
            <p className="text-zinc-400 text-sm">
              de {stats.total_users} participantes
            </p>
          </div>

          {/* Acertos exatos */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <Target className="w-8 h-8 text-red-500" />
              <span className="text-3xl font-bold text-yellow-400">
                {stats.exatos_count}
              </span>
            </div>
            <p className="text-zinc-400 text-sm">Acertos exatos (5 pts)</p>
          </div>

          {/* Acertos de vencedor/empate */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <Award className="w-8 h-8 text-green-500" />
              <span className="text-3xl font-bold text-green-400">
                {stats.vencedores_count}
              </span>
            </div>
            <p className="text-zinc-400 text-sm">
              Acertos de vencedor/empate (3 pts)
            </p>
          </div>

          {/* Palpites errados */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-8 h-8 text-red-500" />
              <span className="text-3xl font-bold text-red-400">
                {stats.erros_count}
              </span>
            </div>
            <p className="text-zinc-400 text-sm">Palpites errados (0 pts)</p>
          </div>

          {/* Total de palpites */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <BarChart2 className="w-8 h-8 text-zinc-400" />
              <span className="text-3xl font-bold text-white">
                {stats.total_palpites}
              </span>
            </div>
            <p className="text-zinc-400 text-sm">
              Jogos finalizados com palpite
            </p>
          </div>
        </div>

        {stats.total_palpites > 0 && (
          <div className="mt-8 bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 text-center">
            <p className="text-zinc-300 mb-2">
              Taxa de acerto (placar exato + vencedor)
            </p>
            <p className="text-4xl font-bold text-green-400">
              {Math.round(
                ((stats.exatos_count + stats.vencedores_count) /
                  stats.total_palpites) *
                  100,
              )}
              %
            </p>
            <p className="text-xs text-zinc-500 mt-2">
              {stats.exatos_count + stats.vencedores_count} acertos em{" "}
              {stats.total_palpites} jogos finalizados
            </p>
          </div>
        )}

        {stats.total_palpites === 0 && (
          <div className="mt-8 bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 text-center text-zinc-400">
            Nenhum jogo finalizado ainda. Acompanhe os próximos resultados!
          </div>
        )}
      </div>
    </div>
  );
}
