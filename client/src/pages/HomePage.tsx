import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import './HomePage.css';

interface Stats {
  employees: number;
  workplaces: number;
}

export default function HomePage() {
  const [stats, setStats] = useState<Stats>({ employees: 0, workplaces: 0 });
  const [displayedStats, setDisplayedStats] = useState<Stats>({ 
    employees: Math.floor(Math.random() * 100), 
    workplaces: Math.floor(Math.random() * 50) 
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (stats.employees > 0 || stats.workplaces > 0) {
      animateCount();
    }
  }, [stats]);

  const fetchStats = async () => {
    try {
      // Načítanie počtu zamestnancov
      const { count: employeesCount } = await supabase
        .from('zamestnanci')
        .select('*', { count: 'exact', head: true });

      // Načítanie počtu pracovísk
      const { count: workplacesCount } = await supabase
        .from('pracoviska')
        .select('*', { count: 'exact', head: true });

      setStats({
        employees: employeesCount || 0,
        workplaces: workplacesCount || 0
      });
    } catch (error) {
      console.error('Chyba pri načítaní štatistík:', error);
    } finally {
      setLoading(false);
    }
  };

  const animateCount = () => {
    const duration = 800; // 0.8 sekundy
    const steps = 30; // Menej krokov pre plynulejší pohyb
    const stepDuration = duration / steps;

    const animate = (currentStep: number) => {
      if (currentStep > steps) return;

      const progress = currentStep / steps;
      // Použijeme easeOutCubic pre plynulejší pohyb
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      
      setDisplayedStats({
        employees: Math.floor(displayedStats.employees + (stats.employees - displayedStats.employees) * easedProgress),
        workplaces: Math.floor(displayedStats.workplaces + (stats.workplaces - displayedStats.workplaces) * easedProgress)
      });

      setTimeout(() => animate(currentStep + 1), stepDuration);
    };

    animate(0);
  };

  return (
    <div className="home-page">
      <div className="progress-section">
        <h2>Aplikácia dokončená na:</h2>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: '65%' }}></div>
        </div>
      </div>

      <div className="welcome-section">
        <h1>Vitajte v systéme Zadelovanie</h1>
        <p>Váš nástroj pre efektívne riadenie zamestnancov a pracovísk</p>
      </div>

      <div className="stats-section">
        <div className="stat-card">
          <h3>Zamestnanci</h3>
          <div className="stat-number">
            {loading ? '...' : displayedStats.employees}
          </div>
        </div>

        <div className="stat-card">
          <h3>Pracoviská</h3>
          <div className="stat-number">
            {loading ? '...' : displayedStats.workplaces}
          </div>
        </div>
      </div>
    </div>
  );
} 