import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./supabase";
import Login from "./pages/Login";
import CreateProfile from "./pages/CreateProfile";
import Dashboard from "./pages/Dashboard";
import AdminPanel from "./pages/AdminPanel";
import Ranking from "./pages/Ranking";
import Stats from "./pages/Stats";
import UserManagement from "./pages/UserManagement";
import PublicPredictions from "./pages/PublicPredictions";
import BrazilGames from "./pages/BrazilGames";

export default function App() {
  const [session, setSession] = useState(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) checkProfile(session.user.id);
      else setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) checkProfile(session.user.id);
      else {
        setHasProfile(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkProfile = async (userId) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("username, active")
      .eq("id", userId)
      .single();

    if (error || !data?.username) {
      setHasProfile(false);
      setLoading(false);
      return;
    }

    if (data.active === false) {
      // Usuário desativado: desloga e redireciona
      await supabase.auth.signOut();
      setHasProfile(false);
      setLoading(false);
      window.location.href = "/?deactivated=true";
      return;
    }

    setHasProfile(true);
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
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            !session ? (
              <Login />
            ) : hasProfile ? (
              <Navigate to="/dashboard" />
            ) : (
              <Navigate to="/setup" />
            )
          }
        />
        <Route
          path="/setup"
          element={
            session && !hasProfile ? (
              <CreateProfile
                session={session}
                onProfileCreated={() => setHasProfile(true)}
              />
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/dashboard"
          element={session && hasProfile ? <Dashboard /> : <Navigate to="/" />}
        />
        <Route
          path="/admin"
          element={session && hasProfile ? <AdminPanel /> : <Navigate to="/" />}
        />
        <Route
          path="/ranking"
          element={session && hasProfile ? <Ranking /> : <Navigate to="/" />}
        />
        <Route
          path="/stats"
          element={session && hasProfile ? <Stats /> : <Navigate to="/" />}
        />
        <Route
          path="/admin/users"
          element={
            session && hasProfile ? <UserManagement /> : <Navigate to="/" />
          }
        />
        <Route
          path="/previsoes"
          element={
            session && hasProfile ? <PublicPredictions /> : <Navigate to="/" />
          }
        />
        <Route
          path="/brasil"
          element={
            session && hasProfile ? <BrazilGames /> : <Navigate to="/" />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
