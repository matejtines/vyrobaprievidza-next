import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import supabase from '../lib/supabase';
import './Navbar.css';

const Navbar = () => {
  const { user } = useUser();

  useEffect(() => {
    console.log('Aktuálny používateľ:', user);
  }, [user]);

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          Zadelovanie
        </Link>
        <div className="navbar-links">
          <Link to="/schedule" className="nav-link">
            Harmonogram
          </Link>
          <Link to="/workplaces" className="nav-link">
            Pracoviská
          </Link>
          <Link to="/vz" className="nav-link">
            VZ/Zoraďovači
          </Link>
          <Link to="/mechanics" className="nav-link">
            Mechanici
          </Link>
          <Link to="/mechanics-new" className="nav-link">
            Mechanici (Nová verzia)
          </Link>
          <Link to="/norms" className="nav-link">
            Normy
          </Link>
          <Link to="/semaphore" className="nav-link">
            Semafor
          </Link>
          {user?.role === 'admin' && (
            <Link to="/admin" className="nav-link admin-link">
              Admin
            </Link>
          )}
          {!user ? (
            <Link to="/login" className="nav-link login-link">
              Prihlásiť sa
            </Link>
          ) : (
            <button 
              onClick={() => supabase.auth.signOut()} 
              className="nav-link logout-button"
            >
              Odhlásiť sa
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 