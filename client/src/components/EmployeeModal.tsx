import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

interface EmployeeModalProps {
  employee: {
    id: number;
    meno: string;
    zmena: string;
    nocne: boolean;
    kategoria: string;
    zaciatok7: boolean;
    angetura: boolean;
  };
  onClose: () => void;
  onUpdate: () => void;
  canDelete?: boolean;
}

const EmployeeModal: React.FC<EmployeeModalProps> = ({ employee, onClose, onUpdate, canDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedEmployee, setEditedEmployee] = useState(employee);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from('zamestnanci')
        .delete()
        .eq('id', employee.id);

      if (error) throw error;
      onUpdate();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nastala chyba pri odstraňovaní zamestnanca');
    }
  };

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from('zamestnanci')
        .update(editedEmployee)
        .eq('id', employee.id);

      if (error) throw error;
      
      setEditedEmployee(editedEmployee);
      Object.assign(employee, editedEmployee);
      setIsEditing(false);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nastala chyba pri ukladaní zmien');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setEditedEmployee(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  return (
    <div className="employee-modal-overlay" onClick={onClose}>
      <div className="employee-modal" onClick={e => e.stopPropagation()}>
        <div className="employee-modal-header">
          <h2 className="employee-modal-title">Detail zamestnanca</h2>
          <button className="employee-modal-close" onClick={onClose}>×</button>
        </div>
        
        {error && <div className="error-message">{error}</div>}

        <div className="employee-modal-content">
          <div className="employee-modal-row">
            <span className="employee-modal-label">Meno:</span>
            {isEditing ? (
              <input
                type="text"
                name="meno"
                value={editedEmployee.meno}
                onChange={handleChange}
                className="employee-modal-input"
              />
            ) : (
              <span className="employee-modal-value">{employee.meno}</span>
            )}
          </div>
          <div className="employee-modal-row">
            <span className="employee-modal-label">Zmena:</span>
            {isEditing ? (
              <select
                name="zmena"
                value={editedEmployee.zmena}
                onChange={handleChange}
                className="employee-modal-input"
              >
                <option value="A">A</option>
                <option value="C">C</option>
                <option value="D">D</option>
                <option value="O">O</option>
                <option value="R/P">R/P</option>
                <option value="A12">A12</option>
                <option value="B12">B12</option>
                <option value="C12">C12</option>
                <option value="D12">D12</option>
              </select>
            ) : (
              <span className="employee-modal-value">{employee.zmena}</span>
            )}
          </div>
          <div className="employee-modal-row">
            <span className="employee-modal-label">Nočné zmeny:</span>
            {isEditing ? (
              <input
                type="checkbox"
                name="nocne"
                checked={editedEmployee.nocne}
                onChange={handleChange}
                className="employee-modal-checkbox"
              />
            ) : (
              <span className="employee-modal-value">{employee.nocne ? 'Áno' : 'Nie'}</span>
            )}
          </div>
          <div className="employee-modal-row">
            <span className="employee-modal-label">Začiatok o 7:00:</span>
            {isEditing ? (
              <input
                type="checkbox"
                name="zaciatok7"
                checked={editedEmployee.zaciatok7}
                onChange={handleChange}
                className="employee-modal-checkbox"
              />
            ) : (
              <span className="employee-modal-value">{employee.zaciatok7 ? 'Áno' : 'Nie'}</span>
            )}
          </div>
          <div className="employee-modal-row">
            <span className="employee-modal-label">Kategória:</span>
            {isEditing ? (
              <select
                name="kategoria"
                value={editedEmployee.kategoria}
                onChange={handleChange}
                className="employee-modal-input"
              >
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            ) : (
              <span className="employee-modal-value">{employee.kategoria}</span>
            )}
          </div>
          <div className="employee-modal-row">
            <span className="employee-modal-label">Angetúra:</span>
            {isEditing ? (
              <input
                type="checkbox"
                name="angetura"
                checked={editedEmployee.angetura}
                onChange={handleChange}
                className="employee-modal-checkbox"
              />
            ) : (
              <span className="employee-modal-value">{employee.angetura ? 'Áno' : 'Nie'}</span>
            )}
          </div>
        </div>

        <div className="employee-modal-actions">
          {isEditing ? (
            <button className="employee-modal-button save" onClick={handleSave}>
              Uložiť zmeny
            </button>
          ) : (
            canDelete && (
              <button className="employee-modal-button edit" onClick={() => setIsEditing(true)}>
                Upraviť
              </button>
            )
          )}
          {canDelete && (
            <button className="employee-modal-button delete" onClick={handleDelete}>
              Odstrániť
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeModal; 