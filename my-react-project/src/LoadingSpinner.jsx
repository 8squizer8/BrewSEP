// src/LoadingSpinner.jsx

import React from 'react';
import './LoadingSpinner.css'; // Vamos criar este CSS a seguir

const LoadingSpinner = () => {
  return (
    <div className="spinner-container">
      <div className="spinner"></div>
    </div>
  );
};

export default LoadingSpinner;