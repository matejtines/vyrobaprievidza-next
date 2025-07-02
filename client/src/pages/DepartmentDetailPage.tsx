import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import './DepartmentDetailPage.css';
import { format, parseISO } from 'date-fns';
import { sk } from 'date-fns/locale';
import ConfirmDialog from '../components/ConfirmDialog';

interface Department {
    id: string;
    name: string;
    created_at: string;
    created_by: string | null;
}

interface Book {
    id: string;
    name: string;
    department_id: string;
    created_at: string;
    created_by: string | null;
}

interface BookStats {
    totalNotes: number;
}

const DepartmentDetailPage: React.FC = () => {
    const { departmentId } = useParams<{ departmentId: string }>();
    const { user } = useUser();
    const navigate = useNavigate();
    const [department, setDepartment] = useState<Department | null>(null);
    const [books, setBooks] = useState<Book[]>([]);
    const [bookStats, setBookStats] = useState<{ [key: string]: BookStats }>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);

    const hasPermission = (action: 'create' | 'delete'): boolean => {
        if (!user || !department) return false;

        const role = user.role;
        const departmentName = department.name.toLowerCase();

        if (role === 'admin') return true;

        switch (departmentName) {
            case 'kvalita':
                return role === 'managerkvalita';
            case 'mechanici':
                return role === 'managermechanik';
            default:
                return role === 'manager';
        }
    };

    const fetchDepartmentDetails = async () => {
        if (!departmentId) return;
        setLoading(true);
        
        const { data: departmentData, error: departmentError } = await supabase
            .from('departments').select('*').eq('id', departmentId).single();

        if (departmentError) {
            console.error('Error fetching department details:', departmentError);
            setError('Chyba pri načítaní oddelenia');
            setLoading(false);
            return;
        }
        setDepartment(departmentData);

        const { data: booksData, error: booksError } = await supabase
            .from('books')
            .select('*')
            .eq('department_id', departmentId)
            .order('name', { ascending: true });

        if (booksError) {
            console.error('Error fetching books:', booksError);
            setError('Chyba pri načítaní zložiek');
        } else {
            setBooks(booksData || []);
            await fetchBookStats(booksData || []);
        }

        setLoading(false);
    };

    const fetchBookStats = async (booksList: Book[]) => {
        const stats: { [key: string]: BookStats } = {};
        
        for (const book of booksList) {
            const { count: notesCount } = await supabase
                .from('notes')
                .select('*', { count: 'exact', head: true })
                .eq('book_id', book.id);

            stats[book.id] = {
                totalNotes: notesCount || 0
            };
        }
        
        setBookStats(stats);
    };

    useEffect(() => {
        fetchDepartmentDetails();
    }, [departmentId]);

    const handleDeleteBook = (bookId: string) => {
        setShowDeleteDialog(bookId);
    };

    const confirmDeleteBook = async () => {
        if (!showDeleteDialog || !user) return;

        const { error } = await supabase
            .from('books')
            .delete()
            .eq('id', showDeleteDialog)
            .eq('created_by', user.id);

        if (error) {
            console.error('Error deleting book:', error);
            setError('Chyba pri mazaní zložky');
        } else {
            await fetchDepartmentDetails();
        }
        setShowDeleteDialog(null);
    };

    if (loading) {
        return (
            <div className="department-detail-page">
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p className="loading-text">Načítavam zložky...</p>
                </div>
            </div>
        );
    }

    if (error || !department) {
        return (
            <div className="department-detail-page">
                <div className="error-container">
                    <p>{error || 'Oddelenie nebolo nájdené'}</p>
                    <button onClick={() => navigate('/books')} className="retry-btn">
                        Späť na oddelenia
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="department-detail-page">
            <header className="department-detail-header">
                <div className="department-detail-header-content">
                    <div className="header-text-container">
                        <Link to="/books" className="back-link">
                            <span>←</span>
                            <span>Späť na oddelenia</span>
                        </Link>
                        <h1>{department.name}</h1>
                        <p>Zložky v oddelení</p>
                    </div>
                    {hasPermission('create') && (
                        <Link to={`/create-book/${departmentId}`} className="add-book-btn-header">
                            + Vytvoriť zložku
                        </Link>
                    )}
                </div>
            </header>

            <main className="department-detail-main">
                {books.length === 0 ? (
                    <div className="empty-state">
                        <h3>Žiadne zložky</h3>
                        <p>Začnite vytvorením prvej zložky</p>
                        {hasPermission('create') && (
                            <Link to={`/create-book/${departmentId}`} className="create-book-btn">
                                + Vytvoriť zložku
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="books-grid">
                        {books.map((book) => (
                            <div 
                                key={book.id} 
                                className="book-card"
                                onClick={() => navigate(`/book/${book.id}`)}
                            >
                                <div className="book-card-content">
                                    <h3>{book.name}</h3>
                                    <p>Vytvorené {format(parseISO(book.created_at), 'd. M. yyyy', { locale: sk })}</p>
                                    <div className="book-stats">
                                        <div className="stat-item">
                                            <span className="stat-number">
                                                {bookStats[book.id]?.totalNotes || 0}
                                            </span>
                                            <span className="stat-label">poznámok</span>
                                        </div>
                                    </div>
                                </div>
                                {hasPermission('delete') && (
                                    <button
                                        className="delete-book-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteBook(book.id);
                                        }}
                                        title="Vymazať zložku"
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
                title="Vymazať zložku"
                message="Naozaj chcete vymazať túto zložku? Všetky poznámky budú tiež vymazané."
                confirmText="Vymazať"
                cancelText="Zrušiť"
                onConfirm={confirmDeleteBook}
                onCancel={() => setShowDeleteDialog(null)}
                type="danger"
            />
        </div>
    );
};

export default DepartmentDetailPage; 