import React, { useState, useEffect } from 'react';
import './WorkplaceForm.css';

const WorkplaceForm = ({ workplace, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    nazov: '',
    popis: ''
  });

  useEffect(() => {
    if (workplace) {
      setFormData({
        nazov: workplace.nazov || '',
        popis: workplace.popis || ''
      });
    }
  }, [workplace]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form className="workplace-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="nazov">Názov pracoviska</label>
        <input
          type="text"
          id="nazov"
          name="nazov"
          value={formData.nazov}
          onChange={handleChange}
          required
          placeholder="Zadajte názov pracoviska"
        />
      </div>

      <div className="form-group">
        <label htmlFor="popis">Popis</label>
        <textarea
          id="popis"
          name="popis"
          value={formData.popis}
          onChange={handleChange}
          placeholder="Zadajte popis pracoviska"
        />
      </div>

      <div className="form-actions">
        <button type="button" className="cancel-button" onClick={onCancel}>
          Zrušiť
        </button>
        <button type="submit" className="submit-button">
          {workplace ? 'Uložiť zmeny' : 'Pridať pracovisko'}
        </button>
      </div>
    </form>
  );
};

export default WorkplaceForm; 