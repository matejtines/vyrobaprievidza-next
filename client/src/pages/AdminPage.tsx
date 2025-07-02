import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import supabase from '../lib/supabase';
import './AdminPage.css';

interface User {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

const AdminPage: React.FC = () => {
  const { user } = useUser();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, role, created_at')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setUsers(data || []);
      } catch (err: any) {
        console.error('Chyba pri načítaní používateľov:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, role: newRole } : u
      ));
    } catch (err: any) {
      console.error('Chyba pri zmene roly:', err);
      alert('Nepodarilo sa zmeniť rolu. Skúste to znova.');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      // Najprv vymažeme profil
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (profileError) throw profileError;

      // Potom vymažeme používateľa z auth.users pomocou admin API
      const { error: authError } = await supabase.rpc('delete_user', {
        user_id: userId
      });

      if (authError) throw authError;

      setUsers(prev => prev.filter(u => u.id !== userId));
      setDeleteConfirm(null);
    } catch (err: any) {
      console.error('Chyba pri mazaní používateľa:', err);
      alert('Nepodarilo sa vymazať používateľa. Skúste to znova.');
    }
  };

  if (!user || user.role !== 'admin') {
    return <div className="admin-page">Nemáte oprávnenie na prístup k tejto stránke.</div>;
  }

  if (loading) return <div className="admin-page">Načítavam...</div>;
  if (error) return <div className="admin-page">Chyba: {error}</div>;

  return (
    <div className="admin-page">
      <h1>Správa používateľov</h1>
      <div className="users-table">
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Rola</th>
              <th>Dátum registrácie</th>
              <th>Akcie</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>{user.email}</td>
                <td>
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    className="role-select"
                  >
                    <option value="user">Používateľ</option>
                    <option value="timlider">Timlider</option>
                    <option value="regularmechanik">Mechanik</option>
                    <option value="regularkvalita">Kvalitár</option>
                    <option value="manager">Manažér</option>
                    <option value="managerkvalita">Manažér kvality</option>
                    <option value="managermechanik">Manažér mechanikov</option>
                    <option value="managervyroby">Manažér výroby</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td>{user.created_at ? new Date(user.created_at).toLocaleDateString('sk-SK') : 'N/A'}</td>
                <td className="actions">
                  <button
                    className="save-button"
                    onClick={() => handleRoleChange(user.id, user.role)}
                  >
                    Uložiť
                  </button>
                  {deleteConfirm === user.id ? (
                    <div className="delete-confirmation">
                      <button
                        className="confirm-delete"
                        onClick={() => handleDeleteUser(user.id)}
                      >
                        Potvrdiť
                      </button>
                      <button
                        className="cancel-delete"
                        onClick={() => setDeleteConfirm(null)}
                      >
                        Zrušiť
                      </button>
                    </div>
                  ) : (
                    <button
                      className="delete-button"
                      onClick={() => setDeleteConfirm(user.id)}
                    >
                      Vymazať
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminPage; 