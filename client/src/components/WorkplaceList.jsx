import React, { useState } from 'react';
import { FaEdit, FaTrash, FaInfoCircle } from 'react-icons/fa';
import WorkplaceModal from './WorkplaceModal';

const WorkplaceList = ({ workplaces, onEdit, onDelete }) => {
  const [selectedWorkplace, setSelectedWorkplace] = useState(null);

  return (
    <>
      <div className="workplaces-list">
        {workplaces.map((workplace) => (
          <div key={workplace.id} className="workplace-card">
            <h3>{workplace.nazov}</h3>
            <p>{workplace.popis}</p>
            <div className="actions">
              <button
                className="action-button"
                onClick={() => setSelectedWorkplace(workplace)}
                title="Zobraziť detaily"
              >
                <FaInfoCircle />
              </button>
              <button
                className="action-button"
                onClick={() => onEdit(workplace)}
                title="Upraviť pracovisko"
              >
                <FaEdit />
              </button>
              <button
                className="action-button delete"
                onClick={() => onDelete(workplace.id)}
                title="Vymazať pracovisko"
              >
                <FaTrash />
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedWorkplace && (
        <WorkplaceModal
          workplace={selectedWorkplace}
          onClose={() => setSelectedWorkplace(null)}
        />
      )}
    </>
  );
};

export default WorkplaceList; 