import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import WorkplaceModal from './WorkplaceModal';

function WorkplacesList({ pracoviska, onWorkplaceDeleted }) {
  const [selectedWorkplace, setSelectedWorkplace] = useState(null);

  const handleWorkplaceClick = (pracovisko) => {
    setSelectedWorkplace(pracovisko);
  };

  const handleCloseModal = () => {
    setSelectedWorkplace(null);
  };

  const handleDeleteWorkplace = async (id) => {
    if (!window.confirm('Naozaj chcete odstrániť toto pracovisko?')) return;

    try {
      const { error } = await supabase
        .from('pracoviska')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setSelectedWorkplace(null);
      onWorkplaceDeleted();
    } catch (error) {
      console.error('Error deleting workplace:', error);
    }
  };

  return (
    <div className="workplaces-sidebar">
      <h3>Zoznam pracovísk</h3>
      <ul className="workplaces-list">
        {pracoviska.map((pracovisko) => (
          <li 
            key={pracovisko.id} 
            className="workplace-item"
            onClick={() => handleWorkplaceClick(pracovisko)}
          >
            {pracovisko.nazov}
          </li>
        ))}
      </ul>

      {selectedWorkplace && (
        <WorkplaceModal
          workplace={selectedWorkplace}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}

export default WorkplacesList; 