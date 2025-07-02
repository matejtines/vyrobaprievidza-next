import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

function AddWorkplaceForm({ onWorkplaceAdded }) {
  const [formData, setFormData] = useState({
    nazov: '',
    popis: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('pracoviska')
        .insert([
          { 
            ...formData,
            created_at: new Date().toISOString()
          }
        ])
        .select();

      if (error) throw error;

      if (onWorkplaceAdded) {
        onWorkplaceAdded(data[0]);
      }

      // Reset formulára
      setFormData({
        nazov: '',
        popis: ''
      });
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container">
      <h2>Pridať pracovisko</h2>
      {error && <div className="error-message">{error}</div>}
      
      <form className="workplace-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="nazov">Názov pracoviska *</label>
          <input
            type="text"
            id="nazov"
            name="nazov"
            value={formData.nazov}
            onChange={handleChange}
            placeholder="Zadajte názov pracoviska"
            required
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="popis">Popis *</label>
          <textarea
            id="popis"
            name="popis"
            value={formData.popis}
            onChange={handleChange}
            placeholder="Zadajte popis pracoviska"
            required
            disabled={loading}
            rows={3}
          />
        </div>

        <button 
          type="submit" 
          className="submit-button"
          disabled={loading}
        >
          {loading ? 'Pridávam...' : 'Pridať pracovisko'}
        </button>
      </form>
    </div>
  );
}

export default AddWorkplaceForm; 