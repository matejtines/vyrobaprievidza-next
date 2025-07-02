import React, { useState } from 'react';
import supabase from '../lib/supabase';

interface AddEmployeeFormProps {
  onEmployeeAdded: () => void;
}

const AddEmployeeForm: React.FC<AddEmployeeFormProps> = ({ onEmployeeAdded }) => {
  const [meno, setMeno] = useState('');
  const [zmena, setZmena] = useState('A');
  const [nocne, setNocne] = useState(false);
  const [kategoria, setKategoria] = useState('operator');
  const [zaciatok7, setZaciatok7] = useState(false);
  const [angetura, setAngetura] = useState(false);
  const [materska, setMaterska] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizeString = (str: string) => {
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Najprv skontrolujeme, či zamestnanec už existuje
      const { data: existingEmployees, error: searchError } = await supabase
        .from('zamestnanci')
        .select('meno');

      if (searchError) throw searchError;

      const normalizedNewName = normalizeString(meno);
      const employeeExists = existingEmployees?.some(emp => 
        normalizeString(emp.meno) === normalizedNewName
      );

      if (employeeExists) {
        setError('Zamestnanec s týmto menom už existuje');
        setLoading(false);
        return;
      }

      // Ak zamestnanec neexistuje, pridáme ho
      const { error } = await supabase
        .from('zamestnanci')
        .insert([
          {
            meno,
            zmena,
            nocne,
            kategoria,
            zaciatok7,
            angetura,
            materska
          }
        ]);

      if (error) throw error;

      setMeno('');
      setZmena('A');
      setNocne(false);
      setKategoria('operator');
      setZaciatok7(false);
      setAngetura(false);
      setMaterska(false);
      onEmployeeAdded();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container">
      <h2>Pridať nového zamestnanca</h2>
      
      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit} className="employee-form">
        <div className="form-group">
          <label htmlFor="meno">Meno:</label>
          <input
            type="text"
            id="meno"
            value={meno}
            onChange={(e) => setMeno(e.target.value)}
            required
            placeholder="Zadajte meno"
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="zmena">Zmena:</label>
          <select
            id="zmena"
            value={zmena}
            onChange={(e) => setZmena(e.target.value)}
            required
            disabled={loading}
          >
            <optgroup label="Štandardné zmeny">
            <option value="A">A</option>
            <option value="C">C</option>
            <option value="D">D</option>
            <option value="O">O</option>
            <option value="R/P">R/P</option>
            </optgroup>
            <optgroup label="12-hodinové zmeny">
            <option value="A12">A12</option>
            <option value="B12">B12</option>
            <option value="C12">C12</option>
            <option value="D12">D12</option>
            </optgroup>
            <optgroup label="Špeciálne zmeny">
              <option value="mechanik">Mechanik</option>
              <option value="kvalita">Kvalita</option>
            </optgroup>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="kategoria">Kategória:</label>
          <select
            id="kategoria"
            value={kategoria}
            onChange={(e) => setKategoria(e.target.value)}
            required
            disabled={loading}
          >
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
        </div>

        <div className="form-group checkbox-group">
          <input
            type="checkbox"
            id="zaciatok7"
            checked={zaciatok7}
            onChange={(e) => setZaciatok7(e.target.checked)}
            disabled={loading}
          />
          <label htmlFor="zaciatok7">Začína o 7:00</label>
        </div>

        <div className="form-group checkbox-group">
          <input
            type="checkbox"
            id="nocne"
            checked={nocne}
            onChange={(e) => setNocne(e.target.checked)}
            disabled={loading}
          />
          <label htmlFor="nocne">Nočné</label>
        </div>

        <div className="form-group checkbox-group">
          <input
            type="checkbox"
            id="angetura"
            checked={angetura}
            onChange={(e) => setAngetura(e.target.checked)}
            disabled={loading}
          />
          <label htmlFor="angetura">Angetúra</label>
        </div>

        <div className="form-group checkbox-group">
          <input
            type="checkbox"
            id="materska"
            checked={materska}
            onChange={(e) => setMaterska(e.target.checked)}
            disabled={loading}
          />
          <label htmlFor="materska">Materská dovolenka</label>
        </div>

        <button 
          type="submit" 
          className="submit-button"
          disabled={loading}
        >
          {loading ? 'Pridávam...' : 'Pridať zamestnanca'}
        </button>
      </form>
    </div>
  );
};

export default AddEmployeeForm; 