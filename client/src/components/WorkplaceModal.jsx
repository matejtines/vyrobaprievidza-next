import React from 'react';
import { FaTimes } from 'react-icons/fa';
import './WorkplaceModal.css';

const WorkplaceModal = ({ workplace, onClose }) => {
  if (!workplace) return null;

  return (
    <div className="workplace-modal-overlay" onClick={onClose}>
      <div className="workplace-modal" onClick={e => e.stopPropagation()}>
        <div className="workplace-modal-header">
          <h2 className="workplace-modal-title">Detaily pracoviska</h2>
          <button className="workplace-modal-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="workplace-modal-content">
          <div className="workplace-modal-row">
            <span className="workplace-modal-label">Názov:</span>
            <span className="workplace-modal-value">{workplace.nazov}</span>
          </div>

          <div className="workplace-modal-row">
            <span className="workplace-modal-label">Popis:</span>
            <span className="workplace-modal-value">{workplace.popis}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkplaceModal; 