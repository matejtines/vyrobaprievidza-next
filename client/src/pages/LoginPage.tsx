import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../lib/supabase';
import { useUser } from '../context/UserContext';
import { Filter } from 'bad-words';
import './LoginPage.css';

// Slovenské vulgarizmy
const slovenskeVulgarizmy = [
  'piča', 'jebat', 'jebem', 'jebnutý', 'jebnutá', 'jebnuté', 'jebnutí',
  'kokot', 'kokotina', 'posratý', 'posraný', 'posraná', 'posrané',
  'kurva', 'kurvy', 'kurvu', 'kurve', 'kurvou', 'kurvač', 'kurvačka',
  'debil', 'debilko', 'debilka', 'debilky', 'debilom', 'debilovi',
  'píča', 'píču', 'píče', 'píčou', 'píčus', 'píčuska',
  'hovno', 'hovná', 'hovnu', 'hovnom', 'hovne',
  'sračka', 'sračky', 'sračku', 'sračkou',
  'pica', 'picu', 'pice', 'picou', 'picus', 'picuska',
  'jebat', 'jebem', 'jebes', 'jebe', 'jebeme', 'jebete', 'jebu',
  'jebnut', 'jebnuty', 'jebnuta', 'jebnute', 'jebnuti',
  'kokot', 'kokoti', 'kokota', 'kokotovi', 'kokotom',
  'posrat', 'posrany', 'posrana', 'posrane', 'posrani',
  'kurva', 'kurvy', 'kurvu', 'kurve', 'kurvou',
  'debil', 'debilko', 'debilka', 'debilky', 'debilom', 'debilovi',
  'pica', 'picu', 'pice', 'picou', 'picus', 'picuska',
  'hovno', 'hovna', 'hovnu', 'hovnom', 'hovne',
  'sracka', 'sracky', 'sracku', 'srackou'
];

const LoginPage: React.FC = () => {
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [matchingUsers, setMatchingUsers] = useState<Array<{name: string, login: string, email: string}>>([]);
  const navigate = useNavigate();
  const { user, refreshUser } = useUser();
  const filter = new Filter();

  filter.addWords(...slovenskeVulgarizmy);

  // Funkcia na formátovanie mena a priezviska
  const formatName = (input: string): string => {
    return input
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setShowNamePrompt(false);
    setMatchingUsers([]);

    try {
      // Skontrolujeme, či vstup obsahuje medzeru (meno a priezvisko)
      const inputParts = loginInput.trim().split(' ');
      
      if (inputParts.length > 1) {
        // Ak používateľ zadal meno aj priezvisko
        const inputName = formatName(inputParts[0]);
        const inputSurname = formatName(inputParts.slice(1).join(' ')); // Spojíme zvyšné časti pre prípad viacslovných priezvisk

        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('email')
          .eq('name', inputSurname)
          .eq('login', inputName)
          .single();

        if (userError) {
          setError('Používateľ nebol nájdený');
          return;
        }

        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: userData.email,
          password,
        });

        if (authError) throw authError;

        if (authData.user) {
          await refreshUser();
          navigate('/');
        }
      } else {
        // Ak používateľ zadal len priezvisko
        const formattedSurname = formatName(loginInput);
        const { data: users, error: searchError } = await supabase
          .from('profiles')
          .select('name, login, email')
          .eq('name', formattedSurname);

        if (searchError) throw searchError;

        if (users && users.length > 1) {
          // Ak existuje viacero používateľov s tým istým priezviskom
          setMatchingUsers(users);
          setShowNamePrompt(true);
          setError('Zadajte aj meno pre prihlásenie (napr. "Matej Tines")');
          return;
        }

        if (users && users.length === 1) {
          // Ak existuje len jeden používateľ s tým priezviskom
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: users[0].email,
            password,
          });

          if (authError) throw authError;

          if (authData.user) {
            await refreshUser();
            navigate('/');
          }
        } else {
          setError('Používateľ nebol nájdený');
        }
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password || !name || !surname) {
      setError('Všetky polia sú povinné');
      return;
    }

    // Formátujeme meno a priezvisko
    const formattedName = formatName(name);
    const formattedSurname = formatName(surname);

    if (filter.isProfane(formattedName) || filter.isProfane(formattedSurname)) {
      setError('Meno a priezvisko nesmú obsahovať vulgarizmy');
      return;
    }

    try {
      // Najprv skontrolujeme, či už existuje používateľ s týmto emailom
      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        setError('Používateľ s týmto emailom už existuje');
        return;
      }

      // Registrácia v auth systéme
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password
      });

      if (signUpError) throw signUpError;

      if (!data.user) {
        throw new Error('Nepodarilo sa vytvoriť používateľa');
      }

      // Počkáme chvíľu, aby sa stihol vytvoriť profil automaticky
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Skontrolujeme, či profil už existuje
      const { data: existingProfile, error: profileCheckError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .single();

      if (profileCheckError && profileCheckError.code !== 'PGRST116') {
        throw profileCheckError;
      }

      if (!existingProfile) {
        // Vytvorenie profilu len ak neexistuje
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([
            {
              id: data.user.id,
              email: email,
              name: formattedSurname, // Ukladáme priezvisko do name
              login: formattedName,   // Ukladáme meno do login
              role: 'user'
            }
          ]);

        if (profileError) throw profileError;
      } else {
        // Aktualizujeme existujúci profil
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            name: formattedSurname,  // Ukladáme priezvisko do name
            login: formattedName     // Ukladáme meno do login
          })
          .eq('id', data.user.id);

        if (updateError) throw updateError;
      }

      setShowSuccessModal(true);

    } catch (err: any) {
      console.error('Chyba pri registrácii:', err);
      setError(err.message || 'Nastala chyba pri registrácii');
    }
  };

  const handleSuccessConfirm = () => {
    setShowSuccessModal(false);
    setIsRegistering(false);
    setError(null);
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>{isRegistering ? 'Registrácia' : 'Prihlásenie'}</h2>
        {!user ? (
          <form onSubmit={isRegistering ? handleRegister : handleLogin} className="auth-form">
            {isRegistering ? (
              <>
                <div className="form-group">
                  <input
                    type="text"
                    placeholder="Meno"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="auth-input"
                    required
                  />
                </div>
                <div className="form-group">
                  <input
                    type="text"
                    placeholder="Priezvisko"
                    value={surname}
                    onChange={(e) => setSurname(e.target.value)}
                    className="auth-input"
                    required
                  />
                </div>
                <div className="form-group">
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="auth-input"
                    required
                  />
                </div>
              </>
            ) : (
              <div className="form-group">
                <input
                  type="text"
                  placeholder={showNamePrompt ? "Zadajte meno a priezvisko (napr. Matej Tines)" : "Zadajte priezvisko"}
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  className="auth-input"
                  required
                />
                {showNamePrompt && matchingUsers.length > 0 && (
                  <div className="matching-users">
                    <p>Nájdení používatelia s týmto priezviskom:</p>
                    <ul>
                      {matchingUsers.map((user, index) => (
                        <li key={index}>{user.login} {user.name}</li>
                      ))}
                    </ul>
                    <p className="matching-users__hint">Zadajte meno a priezvisko v tvare "Meno Priezvisko"</p>
                  </div>
                )}
              </div>
            )}
            <div className="form-group">
              <input
                type="password"
                placeholder="Heslo"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input"
                required
              />
            </div>
            {error && (
              <div className="message error">
                {error}
              </div>
            )}
            <button type="submit" className="auth-button">
              {isRegistering ? 'Registrovať' : 'Prihlásiť'}
            </button>
          </form>
        ) : (
          <div className="auth-form">
            <div className="message success">
              Ste prihlásený ako {user.login}
            </div>
            <button 
              className="auth-button"
              onClick={async () => {
                await supabase.auth.signOut();
                await refreshUser();
                navigate('/');
              }}
            >
              Odhlásiť sa
            </button>
          </div>
        )}
        {!user && (
          <div className="auth-switch">
            <button
              type="button"
              className="switch-button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError(null);
                setShowNamePrompt(false);
                setMatchingUsers([]);
              }}
            >
              {isRegistering
                ? 'Už máte účet? Prihláste sa'
                : 'Nemáte účet? Zaregistrujte sa'}
            </button>
          </div>
        )}
      </div>

      {showSuccessModal && (
        <div className="success-modal">
          <div className="success-modal__content">
            <div className="success-modal__icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor"/>
              </svg>
            </div>
            <div className="success-modal__header">
              <h3>Úspešná registrácia</h3>
            </div>
            <div className="success-modal__body">
              <p>Účet bol úspešne vytvorený!</p>
            </div>
            <div className="success-modal__footer">
              <button className="success-modal__button" onClick={handleSuccessConfirm}>
                Pokračovať
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage; 