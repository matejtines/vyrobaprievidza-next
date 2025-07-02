import React, { useState, useEffect } from 'react';
import AddEmployeeForm from '../components/AddEmployeeForm.tsx';
import EmployeeModal from '../components/EmployeeModal';
import { supabase } from '../lib/supabase';
import './employees.css';
import { useUser } from '../context/UserContext';
import { FaSearch, FaUserPlus, FaUsers, FaFilter } from 'react-icons/fa';

interface Employee {
  id: number;
  meno: string;
  zmena: string;
  nocne: boolean;
  kategoria: string;
  zaciatok7: boolean;
  angetura: boolean;
  materska: boolean;
}

const SHIFT_GROUPS = {
  'Štandardné zmeny': ['A', 'C', 'D', 'O', 'R/P'],
  '12-hodinové zmeny': ['A12', 'B12', 'C12', 'D12'],
  'Špeciálne zmeny': ['mechanik', 'kvalita']
};

export default function Employees() {
  const { user } = useUser();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('zamestnanci')
        .select('*')
        .order('meno');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Chyba pri načítaní zamestnancov:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeClick = (employee: Employee) => {
    setSelectedEmployee(employee);
  };

  const handleCloseModal = () => {
    setSelectedEmployee(null);
  };

  const handleUpdate = (newEmployee?: Employee) => {
    if (newEmployee) {
      setEmployees(prevEmployees => {
        const updatedEmployees = [...prevEmployees, newEmployee];
        return updatedEmployees.sort((a, b) => a.meno.localeCompare(b.meno));
      });
    } else {
      fetchEmployees();
    }
  };

  const getEmployeesByShift = (shift: string) => {
    return employees.filter(emp => emp.zmena === shift);
  };

  const filteredEmployees = employees.filter(employee => {
    const searchTermLower = searchTerm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const employeeNameLower = employee.meno.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const matchesSearch = employeeNameLower.includes(searchTermLower);
    
    if (activeFilter === 'all') return matchesSearch;
    if (activeFilter === 'nocne') return matchesSearch && employee.nocne;
    if (activeFilter === 'angetura') return matchesSearch && employee.angetura;
    if (activeFilter === 'materska') return matchesSearch && employee.materska;
    if (activeFilter === 'zaciatok7') return matchesSearch && employee.zaciatok7;
    
    return matchesSearch;
  });

  const renderEmployeeGroups = () => {
    return Object.entries(SHIFT_GROUPS).map(([groupName, shifts]) => (
      <div key={groupName} className="employee-group">
        <h4 className="employee-group-title">{groupName}</h4>
        <div className="employee-group-content">
          {shifts.map(shift => {
            const shiftEmployees = filteredEmployees.filter(emp => emp.zmena === shift);
            if (shiftEmployees.length === 0) return null;
            
            return (
              <div key={shift} className="shift-section">
                <h5 className="shift-title">{shift}</h5>
                <div className="shift-employees">
                  {shiftEmployees.map(employee => (
                    <div
                      key={employee.id}
                      className={`employee-card ${employee.materska ? 'materska' : ''} ${employee.angetura ? 'angetura' : ''}`}
                      onClick={() => handleEmployeeClick(employee)}
                    >
                      <div className="employee-card-content">
                        <span className="employee-name">{employee.meno}</span>
                        <div className="employee-badges">
                          {employee.nocne && <span className="badge nocne">Nočné</span>}
                          {employee.zaciatok7 && <span className="badge zaciatok7">7:00</span>}
                          {employee.angetura && <span className="badge angetura">Agentúra</span>}
                          {employee.materska && <span className="badge materska">MD</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ));
  };

  return (
    <div className="employees-page">
      <div className="employees-main">
        <div className="employees-header">
          <div className="header-content">
        <h2>Správa zamestnancov</h2>
            <p>Pridávať a upravovať zamestnancov môže iba administrátor, vedúci alebo timlíder.</p>
          </div>
          {(user?.role === 'admin' || user?.role === 'manager' || user?.role === 'timlider') && (
            <button 
              className="add-employee-button"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              <FaUserPlus />
              {showAddForm ? 'Zatvoriť formulár' : 'Pridať zamestnanca'}
            </button>
          )}
      </div>

        {(user?.role === 'admin' || user?.role === 'manager' || user?.role === 'timlider') && (
          <AddEmployeeForm onEmployeeAdded={() => {
            handleUpdate();
            setShowAddForm(false);
          }} />
        )}

        <div className="employees-filters">
        <div className="search-container">
            <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Hľadať podľa mena..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
          <div className="filter-buttons">
            <button 
              className={`filter-button ${activeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              <FaUsers /> Všetci
            </button>
            <button 
              className={`filter-button ${activeFilter === 'nocne' ? 'active' : ''}`}
              onClick={() => setActiveFilter('nocne')}
            >
              <FaFilter /> Nočné
            </button>
            <button 
              className={`filter-button ${activeFilter === 'angetura' ? 'active' : ''}`}
              onClick={() => setActiveFilter('angetura')}
            >
              <FaFilter /> Agentúra
            </button>
            <button 
              className={`filter-button ${activeFilter === 'materska' ? 'active' : ''}`}
              onClick={() => setActiveFilter('materska')}
            >
              <FaFilter /> Materská
            </button>
            <button 
              className={`filter-button ${activeFilter === 'zaciatok7' ? 'active' : ''}`}
              onClick={() => setActiveFilter('zaciatok7')}
            >
              <FaFilter /> Začína 7:00
            </button>
          </div>
        </div>

        <div className="employees-content">
        {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Načítavam zamestnancov...</p>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="no-results">
              <FaUsers className="no-results-icon" />
              <p>Neboli nájdení žiadni zamestnanci</p>
            </div>
          ) : (
            <div className="employees-grid">
              {renderEmployeeGroups()}
            </div>
          )}
        </div>
      </div>

      {selectedEmployee && (
        <EmployeeModal 
          employee={selectedEmployee} 
          onClose={handleCloseModal}
          onUpdate={handleUpdate}
          canDelete={user?.role === 'admin' || user?.role === 'manager' || user?.role === 'timlider'}
        />
      )}
    </div>
  );
} 