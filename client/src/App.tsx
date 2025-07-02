import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import './App.css';
import HomePage from './pages/HomePage';
import Employees from './pages/Employees';
import WorkplacesPage from './pages/WorkplacesPage';
import SchedulePage from './pages/SchedulePage';
import VacationPage from './pages/VacationPage';
import VZPage from './pages/VZPage';
import NormsPage from './pages/NormsPage';
import SemaphorePage from './pages/SemaphorePage';
import LoginPage from './pages/LoginPage';
import AdminPage from './pages/AdminPage';
import ProtectedRoute from './components/ProtectedRoute';
import supabase from './lib/supabase';
import { UserProvider, useUser } from './context/UserContext';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ChatPage } from './pages/ChatPage';
import MechanicsPage from './pages/MechanicsPage';
import QualityPage from './pages/QualityPage';
import ToDoPage from './pages/ToDoPage';
import TopicDetailPage from './pages/TopicDetailPage';
import BookPage from './pages/BookPage';
import DepartmentDetailPage from './pages/DepartmentDetailPage';
import BookDetailPage from './pages/BookDetailPage';

const Header = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };
  
  return (
    <header className="header">
      <img src="/berrylogo.png" alt="Berry Logo" className="logo" />
      <h1>Správca Výroby</h1>
      {user && (
        <button className="logout-btn" onClick={handleLogout} title="Odhlásiť sa">Odhlásiť sa</button>
      )}
    </header>
  );
};

const Menu = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(true);
  const { user } = useUser();

  return (
    <nav
      className={`menu${collapsed ? ' collapsed' : ''}`}
      onMouseEnter={() => setCollapsed(false)}
      onMouseLeave={() => setCollapsed(true)}
    >
      <Link 
        to="/" 
        className={`menu-button ${location.pathname === '/' ? 'active' : ''}`}
        title="Domov"
      >
        <span className="icon">🏠</span>
        {!collapsed && <span>Domov</span>}
      </Link>
      <Link 
        to="/harmonogram-zmien" 
        className={`menu-button ${location.pathname === '/harmonogram-zmien' ? 'active' : ''}`}
        title="Harmonogram zmien"
      >
        <span className="icon">📅</span>
        {!collapsed && <span>Harmonogram zmien</span>}
      </Link>
      <Link 
        to="/semafory" 
        className={`menu-button ${location.pathname === '/semafory' ? 'active' : ''}`}
        title="Semafór"
      >
        <span className="icon">🚦</span>
        {!collapsed && <span>Semafór</span>}
      </Link>
      <Link 
        to="/dovolenky" 
        className={`menu-button ${location.pathname === '/dovolenky' ? 'active' : ''}`}
        title="Dovolenky"
      >
        <span className="icon">🏖️</span>
        {!collapsed && <span>Dovolenky | PN | §</span>}
      </Link>
      <Link 
        to="/vz" 
        className={`menu-button ${location.pathname === '/vz' ? 'active' : ''}`}
        title="VZ/Zor./Man."
      >
        <span className="icon">📋</span>
        {!collapsed && <span>VZ/Zor./Man.</span>}
      </Link>
      <Link 
        to="/mechanici" 
        className={`menu-button ${location.pathname === '/mechanici' ? 'active' : ''}`}
        title="Mechanici"
      >
        <span className="icon">🔧</span>
        {!collapsed && <span>Mechanici</span>}
      </Link>
      <Link 
        to="/kvalita" 
        className={`menu-button ${location.pathname === '/kvalita' ? 'active' : ''}`}
        title="Kvalita"
      >
        <span className="icon">🔍</span>
        {!collapsed && <span>Kvalita</span>}
      </Link>
      <Link 
        to="/zamestnanci" 
        className={`menu-button ${location.pathname === '/zamestnanci' ? 'active' : ''}`}
        title="Zamestnanci"
      >
        <span className="icon">👥</span>
        {!collapsed && <span>Zamestnanci</span>}
      </Link>
      <Link 
        to="/pracoviska" 
        className={`menu-button ${location.pathname === '/pracoviska' ? 'active' : ''}`}
        title="Pracoviská"
      >
        <span className="icon">🏢</span>
        {!collapsed && <span>Pracoviská</span>}
      </Link>
      <Link 
        to="/todo" 
        className={`menu-button ${location.pathname.startsWith('/todo') ? 'active' : ''}`}
        title="ToDo"
      >
        <span className="icon">✅</span>
        {!collapsed && <span>ToDo</span>}
      </Link>
      <Link 
        to="/chat" 
        className={`menu-button ${location.pathname === '/chat' ? 'active' : ''}`}
        title="Chat"
      >
        <span className="icon">💬</span>
        {!collapsed && <span>Chat</span>}
      </Link>
      <Link 
        to="/books" 
        className={`menu-button ${location.pathname.startsWith('/books') || location.pathname.startsWith('/department') ? 'active' : ''}`}
        title="Kniha oddelení"
      >
        <span className="icon">📚</span>
        {!collapsed && <span>Kniha oddelení</span>}
      </Link>
      {user?.role === 'admin' && (
        <Link 
          to="/admin" 
          className={`menu-button ${location.pathname === '/admin' ? 'active' : ''}`}
          title="Admin"
        >
          <span className="icon">👑</span>
          {!collapsed && <span>Admin</span>}
        </Link>
      )}
    </nav>
  );
};

// Komponent pre kontrolu autentifikácie
const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, error, refreshUser } = useUser();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Načítavam...</div>;
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#fff', background: '#1a2233' }}>
        <div style={{ marginBottom: 24, fontSize: 20, color: '#ef5350' }}>{error}</div>
        <button
          style={{ padding: '12px 24px', borderRadius: 8, background: '#2196F3', color: '#fff', border: 'none', fontSize: 16, cursor: 'pointer', marginBottom: 12 }}
          onClick={async () => {
            await supabase.auth.signOut();
            navigate('/login');
          }}
        >
          Odhlásiť a prihlásiť znova
        </button>
        <button
          style={{ padding: '8px 16px', borderRadius: 8, background: '#334155', color: '#fff', border: 'none', fontSize: 14, cursor: 'pointer', marginBottom: 12 }}
          onClick={refreshUser}
        >
          Skúsiť načítať znova
        </button>
        <button
          style={{ padding: '8px 16px', borderRadius: 8, background: '#ef4444', color: '#fff', border: 'none', fontSize: 14, cursor: 'pointer' }}
          onClick={() => {
            localStorage.clear();
            window.location.href = '/login';
          }}
        >
          Vymazať session a prihlásiť znova
        </button>
      </div>
    );
  }

  if (!user && location.pathname !== '/login') {
    return <Navigate to="/login" replace />;
  }

  if (user && location.pathname === '/login') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const App = () => {
  return (
    <UserProvider>
      <BrowserRouter>
        <AuthGuard>
          <div className="app">
            <Header />
            <div className="main-content">
              <Menu />
              <div className="content">
                <DndProvider backend={HTML5Backend}>
                  <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/" element={<HomePage />} />
                    <Route path="/zamestnanci" element={<Employees />} />
                    <Route path="/pracoviska" element={<WorkplacesPage />} />
                    <Route path="/harmonogram-zmien" element={<SchedulePage />} />
                    <Route path="/dovolenky" element={<VacationPage />} />
                    <Route path="/vz" element={<VZPage />} />
                    <Route path="/normy" element={<NormsPage />} />
                    <Route path="/semafory" element={<SemaphorePage />} />
                    <Route path="/mechanici" element={<MechanicsPage />} />
                    <Route path="/chat" element={<ChatPage />} />
                    <Route path="/kvalita" element={<QualityPage />} />
                    <Route path="/todo" element={<ToDoPage />} />
                    <Route path="/todo/:topicId" element={<TopicDetailPage />} />
                    <Route path="/books" element={<BookPage />} />
                    <Route path="/department/:departmentId" element={<DepartmentDetailPage />} />
                    <Route path="/book/:bookId" element={<BookDetailPage />} />
                    <Route path="/admin" element={<AdminPage />} />
                    <Route path="*" element={<Navigate to="/login" replace />} />
                  </Routes>
                </DndProvider>
              </div>
            </div>
          </div>
        </AuthGuard>
      </BrowserRouter>
    </UserProvider>
  );
};

export default App; 