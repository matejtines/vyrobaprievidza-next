import React, { useState, useEffect } from 'react';
import supabase from '../lib/supabase';
import './VZPage.css';
import { useUser } from '../context/UserContext';

interface VZEmployee {
  id: number;
  meno: string;
  pozicia: string;
  created_at: string;
}

const POZICIE = {
  'Vedúci zmeny': ['VZA12', 'VZB12', 'VZC12', 'VZD12'],
  'Manipulanti': ['ManipulantA', 'ManipulantC', 'ManipulantD', 'ManipulantO'],
  'Zoraďovači': ['ZoradovacA12', 'ZoradovacB12', 'ZoradovacC12', 'ZoradovacD12'],
  'Drvič': ['Drvič']
};

const VZPage: React.FC = () => {
  const { user } = useUser();
  const [employees, setEmployees] = useState<VZEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    meno: '',
    pozicia: ''
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{show: boolean, employeeId: number | null}>({
    show: false,
    employeeId: null
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('vzzorman')
        .select('*')
        .order('meno');

      if (error) throw error;
      setEmployees(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { error } = await supabase
        .from('vzzorman')
        .insert([{
          meno: formData.meno,
          pozicia: formData.pozicia
        }]);

      if (error) throw error;

      // Reset formulára
      setFormData({
        meno: '',
        pozicia: ''
      });

      // Obnovenie zoznamu zamestnancov
      fetchEmployees();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const getEmployeesByPosition = (position: string) => {
    return employees.filter(emp => emp.pozicia === position);
  };

  const handleDeleteEmployee = async (employeeId: number) => {
    try {
      const { error } = await supabase
        .from('vzzorman')
        .delete()
        .eq('id', employeeId);

      if (error) throw error;

      // Obnovenie zoznamu zamestnancov
      fetchEmployees();
      setShowDeleteConfirm({ show: false, employeeId: null });
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) return <div>Načítavam...</div>;
  if (error) return <div>Chyba: {error}</div>;

  return (
    <div className="vz-page">
      <div className="vz-header">
        <h1>VZ/Zor./Man.</h1>
      </div>
      <div className="vz-content">
        <div className="vz-form-section">
          <h2>Pridať nového zamestnanca</h2>
          {(user?.role === 'admin' || user?.role === 'manager' || user?.role === 'timlider') && (
            <form onSubmit={handleSubmit} className="vz-form">
              <div className="form-group">
                <label htmlFor="meno">Meno:</label>
                <input
                  type="text"
                  id="meno"
                  name="meno"
                  value={formData.meno}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="pozicia">Pozícia:</label>
                <select
                  id="pozicia"
                  name="pozicia"
                  value={formData.pozicia}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Vyberte pozíciu</option>
                  <optgroup label="Vedúci zmeny">
                    {POZICIE['Vedúci zmeny'].map(pozicia => (
                      <option key={pozicia} value={pozicia}>{pozicia}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Manipulanti">
                    {POZICIE['Manipulanti'].map(pozicia => (
                      <option key={pozicia} value={pozicia}>{pozicia}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Zoraďovači">
                    {POZICIE['Zoraďovači'].map(pozicia => (
                      <option key={pozicia} value={pozicia}>{pozicia}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Drvič">
                    {POZICIE['Drvič'].map(pozicia => (
                      <option key={pozicia} value={pozicia}>{pozicia}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <button type="submit" className="submit-button">Pridať zamestnanca</button>
            </form>
          )}
        </div>

        <div className="vz-list-section">
          <h2>Zoznam zamestnancov</h2>
          <div className="employees-grid">
            {Object.entries(POZICIE).map(([kategoria, pozicie]) => (
              <div key={kategoria} className="position-group">
                <h3>{kategoria}</h3>
                {pozicie.map(pozicia => {
                  const poziciaEmployees = getEmployeesByPosition(pozicia);
                  return (
                    <div key={pozicia} className="position-section">
                      <h4>{pozicia}</h4>
                      <div className="employees-list">
                        {poziciaEmployees.map((employee) => (
                          <div key={employee.id} className="employee-card">
                            <div className="employee-info">
                              <h5>{employee.meno}</h5>
                              {(user?.role === 'admin' || user?.role === 'manager' || user?.role === 'timlider') && (
                                <button 
                                  className="delete-employee-btn"
                                  onClick={() => setShowDeleteConfirm({ show: true, employeeId: employee.id })}
                                  title="Vymazať zamestnanca"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                        {poziciaEmployees.length === 0 && (
                          <div className="no-employees">Žiadni zamestnanci</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {showDeleteConfirm.show && (
        <div className="delete-confirm-modal">
          <div className="delete-confirm-content">
            <h3>Potvrdenie vymazania</h3>
            <p>Naozaj chcete vymazať tohto zamestnanca?</p>
            <div className="delete-confirm-actions">
              <button 
                className="delete-confirm-btn confirm"
                onClick={() => showDeleteConfirm.employeeId && handleDeleteEmployee(showDeleteConfirm.employeeId)}
              >
                Áno, vymazať
              </button>
              <button 
                className="delete-confirm-btn cancel"
                onClick={() => setShowDeleteConfirm({ show: false, employeeId: null })}
              >
                Zrušiť
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VZPage; 