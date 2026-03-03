import { Navigate, Route, Routes } from "react-router-dom";
import RequireAuth from "./auth/RequireAuth";
import PublicOnly from "./auth/PublicOnly";
import Login from "./components/login";
import Cadastro from "./components/cadastro";
import AppLayout from "./components/layout/AppLayout";
import ProcessosPage from "./app/layout/pages/processos";
import GabinetesPage from "./app/layout/pages/meus-gabinetes";
import SolicitacoesPage from "./app/layout/pages/solicitacoes";
import FavoritosPage from "./app/layout/pages/favoritos";
import Acessos from "./app/layout/pages/acessos";
import Home from "./app/layout/pages/home";
import GabinetesTodosPage from "./app/layout/pages/gabinetes";
import NovoProcessoPage from "./app/layout/pages/processos/novo";
import ProcessoPdfPage from "./app/layout/pages/processos/view";
import GabineteOpenPage from "./app/layout/pages/gabinetes/view";

export default function App() {
  return (
    <Routes>
      {/* Sempre jogar para /gabin */}
      <Route path="/" element={<Navigate to="/gabin/login" replace />} />
      <Route path="/gabin" element={<Navigate to="/gabin/login" replace />} />

      <Route
        path="/gabin/login"
        element={
          <PublicOnly>
            <Login />
          </PublicOnly>
        }
      />

      <Route
        path="/gabin/cadastro"
        element={
          <PublicOnly>
            <Cadastro />
          </PublicOnly>
        }
      />

      <Route
        path="/gabin/app"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        {/* index do /gabin/app */}
        <Route index element={<Navigate to="/gabin/app/processos" replace />} />

        {/* TODAS as rotas com prefixo /gabin */}
        <Route path="/gabin/app/processos" element={<ProcessosPage />} />

        <Route path="/gabin/app/processos" element={<ProcessosPage />} />
        <Route path="/gabin/app/processos/novo" element={<NovoProcessoPage />} />
        <Route path="/gabin/app/processos/:id" element={<ProcessoPdfPage />} />

        <Route path="/gabin/app/gabinetes" element={<GabinetesTodosPage />} />
        <Route path="/gabin/app/gabinetes/:id" element={<GabineteOpenPage />} />
        <Route path="/gabin/app/meus-gabinetes" element={<GabinetesPage />} />

        <Route path="/gabin/app/solicitacoes" element={<SolicitacoesPage />} />
        <Route path="/gabin/app/favoritos" element={<FavoritosPage />} />
        <Route path="/gabin/app/meus-acessos" element={<Acessos />} />

        {/* wildcard dentro do app */}
        <Route path="*" element={<Navigate to="/gabin/app/processos" replace />} />
      </Route>

      {/* wildcard global */}
      <Route path="*" element={<Navigate to="/gabin/login" replace />} />
    </Routes>
  );
}
