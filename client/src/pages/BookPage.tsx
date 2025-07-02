import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import './BookPage.css';
import { format, parseISO } from 'date-fns';
import { sk } from 'date-fns/locale';
import ConfirmDialog from '../components/ConfirmDialog';

interface Department {
    id: string;
    name: string;
    created_at: string;
    created_by: string | null;
}

const BookPage: React.FC = () => {
    const { user } = useUser();
    const navigate = useNavigate();
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);

    const fetchDepartments = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('departments')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching departments:', error);
            setError('Chyba pri načítaní oddelení');
        } else {
            setDepartments(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchDepartments();
    }, []);

    const handleDeleteDepartment = (departmentId: string) => {
        setShowDeleteDialog(departmentId);
    };

    const confirmDeleteDepartment = async () => {
        if (!showDeleteDialog || !user) return;

        const { error } = await supabase
            .from('departments')
            .delete()
            .eq('id', showDeleteDialog)
            .eq('created_by', user.id);

        if (error) {
            console.error('Error deleting department:', error);
            setError('Chyba pri mazaní oddelenia');
        } else {
            await fetchDepartments();
        }
        setShowDeleteDialog(null);
    };

    if (loading) {
        return (
            <div className="book-page">
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p className="loading-text">Načítavam oddelenia...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="book-page">
                <div className="error-container">
                    <p>{error}</p>
                    <button onClick={fetchDepartments} className="retry-btn">
                        Skúsiť znova
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="book-page">
            <header className="book-page-header">
                <div className="book-page-header-content">
                    <div>
                        <h1>Oddelenia</h1>
                        <p>Zaradenie poznámok podľa oddelení</p>
                    </div>
                    {(user?.role === 'admin' || user?.role === 'manager') && (
                        <Link to="/create-department" className="create-department-btn">
                            + Vytvoriť oddelenie
                        </Link>
                    )}
                </div>
            </header>

            <main className="book-page-main">
                {departments.length === 0 ? (
                    <div className="empty-state">
                        <h3>Žiadne oddelenia</h3>
                        <p>Začnite vytvorením prvého oddelenia</p>
                        {(user?.role === 'admin' || user?.role === 'manager') && (
                            <Link to="/create-department" className="create-department-btn">
                                + Vytvoriť oddelenie
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="departments-grid">
                        {departments.map((department) => (
                            <div 
                                key={department.id} 
                                className="department-card"
                                onClick={() => navigate(`/department/${department.id}`)}
                            >
                                <div className="department-card-content">
                                    <h3>{department.name}</h3>
                                </div>
                                {user?.role === 'admin' && (
                                    <button
                                        className="delete-department-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteDepartment(department.id);
                                        }}
                                        title="Vymazať oddelenie"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </main>

            <ConfirmDialog
                isOpen={!!showDeleteDialog}
                title="Vymazať oddelenie"
                message="Naozaj chcete vymazať toto oddelenie? Všetky zložky a poznámky budú tiež vymazané."
                confirmText="Vymazať"
                cancelText="Zrušiť"
                onConfirm={confirmDeleteDepartment}
                onCancel={() => setShowDeleteDialog(null)}
                type="danger"
            />
        </div>
    );
};

export default BookPage; 