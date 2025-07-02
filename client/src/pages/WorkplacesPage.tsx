import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import AddWorkplaceForm from '../components/AddWorkplaceForm';
import WorkplacesList from '../components/WorkplacesList';
import { useUser } from '../context/UserContext';

function WorkplacesPage() {
  const { user } = useUser();
  const [pracoviska, setPracoviska] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWorkplaces();
    
    // Nastavenie real-time subscription
    const subscription = supabase
      .channel('pracoviska_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pracoviska' }, 
        () => {
          fetchWorkplaces();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchWorkplaces = async () => {
    try {
      const { data, error } = await supabase
        .from('pracoviska')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPracoviska(data || []);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleWorkplaceAdded = (newWorkplace: any) => {
    setPracoviska(prev => [newWorkplace, ...prev]);
  };

  const handleWorkplaceDeleted = () => {
    fetchWorkplaces();
  };

  if (loading) return <div className="loading">Načítavam...</div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="workplaces-page">
      <div className="workplaces-main">
        {(user?.role === 'admin' || user?.role === 'manager' || user?.role === 'timlider') && (
          <AddWorkplaceForm onWorkplaceAdded={handleWorkplaceAdded} />
        )}
      </div>
      <WorkplacesList 
        pracoviska={pracoviska} 
        onWorkplaceDeleted={handleWorkplaceDeleted}
      />
    </div>
  );
}

export default WorkplacesPage; 