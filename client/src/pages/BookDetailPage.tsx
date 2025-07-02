import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import './BookDetailPage.css';
import { format, isSameDay, parseISO } from 'date-fns';
import { sk } from 'date-fns/locale';
import ConfirmDialog from '../components/ConfirmDialog';

interface Book {
    id: string;
    name: string;
    department_id: string;
    created_at: string;
    created_by: string | null;
}

interface Department {
    id: string;
    name: string;
}

interface Note {
    id: string;
    book_id: string;
    content: string;
    created_at: string;
    created_by: string | null;
}

interface BookPage {
    date: string;
    notes: Note[];
    pageNumber: number;
}

const BookDetailPage: React.FC = () => {
    const { bookId } = useParams<{ bookId: string }>();
    const { user } = useUser();
    const navigate = useNavigate();
    const [book, setBook] = useState<Book | null>(null);
    const [department, setDepartment] = useState<Department | null>(null);
    const [notes, setNotes] = useState<Note[]>([]);
    const [bookPages, setBookPages] = useState<BookPage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Book navigation
    const [currentPage, setCurrentPage] = useState(0);
    const [isBookOpen, setIsBookOpen] = useState(false);

    // Search functionality
    const [searchTerm, setSearchTerm] = useState('');
    const [searchDate, setSearchDate] = useState('');
    const [filteredPages, setFilteredPages] = useState<BookPage[]>([]);

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newNoteContent, setNewNoteContent] = useState('');

    // Delete dialog states
    const [showDeleteNoteDialog, setShowDeleteNoteDialog] = useState<string | null>(null);

    const hasPermission = (action: 'create' | 'delete', note?: Note): boolean => {
        if (!user || !department) return false;

        const role = user.role;
        const departmentName = department.name.toLowerCase();

        if (action === 'create') {
            if (role === 'admin') return true;
            switch (departmentName) {
                case 'kvalita':
                    return role === 'managerkvalita' || role === 'regularkvalita';
                case 'mechanici':
                    return role === 'managermechanik' || role === 'regularmechanik';
                default:
                    return role === 'manager' || role === 'timlider';
            }
        }

        if (action === 'delete' && note) {
            if (note.created_by === user.id) return true; // Každý môže mazať svoje vlastné
            if (role === 'admin') return true;
            switch (departmentName) {
                case 'kvalita':
                    return role === 'managerkvalita';
                case 'mechanici':
                    return role === 'managermechanik';
                default:
                    return role === 'manager';
            }
        }

        return false;
    };

    const fetchBookDetails = async () => {
        if (!bookId) return;
        setLoading(true);
        
        const { data: bookData, error: bookError } = await supabase
            .from('books').select('*').eq('id', bookId).single();

        if (bookError) {
            console.error('Error fetching book details:', bookError);
            setError('Chyba pri načítaní knihy');
            setLoading(false);
            return;
        }
        setBook(bookData);

        // Fetch department details
        const { data: departmentData, error: departmentError } = await supabase
            .from('departments').select('*').eq('id', bookData.department_id).single();

        if (departmentError) {
            console.error('Error fetching department details:', departmentError);
        } else {
            setDepartment(departmentData);
        }

        const { data: notesData, error: notesError } = await supabase
            .from('notes')
            .select('*')
            .eq('book_id', bookId)
            .order('created_at', { ascending: false });

        if (notesError) {
            console.error('Error fetching notes:', notesError);
            setError('Chyba pri načítaní poznámok');
        } else {
            setNotes(notesData || []);
            createBookPages(notesData || []);
        }

        setLoading(false);
    };

    const createBookPages = (notesList: Note[]) => {
        const grouped: { [key: string]: Note[] } = {};
        
        notesList.forEach(note => {
            const dateKey = format(parseISO(note.created_at), 'yyyy-MM-dd');
            if (!grouped[dateKey]) {
                grouped[dateKey] = [];
            }
            grouped[dateKey].push(note);
        });

        const sortedGroups = Object.entries(grouped)
            .sort(([a], [b]) => b.localeCompare(a)) // Najnovšie dátumy prvé
            .map(([date, notes], index) => ({
                date,
                notes: notes.sort((a, b) => 
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                ),
                pageNumber: index + 1
            }));

        setBookPages(sortedGroups);
        setFilteredPages(sortedGroups);
    };

    useEffect(() => {
        fetchBookDetails();
    }, [bookId]);

    useEffect(() => {
        // Filter pages based on search
        let filtered = bookPages;

        if (searchTerm.trim()) {
            filtered = filtered.map(page => ({
                ...page,
                notes: page.notes.filter(note => 
                    note.content.toLowerCase().includes(searchTerm.toLowerCase())
                )
            })).filter(page => page.notes.length > 0);
        }

        if (searchDate) {
            filtered = filtered.filter(page => 
                page.date === searchDate
            );
        }

        setFilteredPages(filtered);
        setCurrentPage(0); // Reset to first page when filtering
    }, [searchTerm, searchDate, bookPages]);

    const handleCreateNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newNoteContent.trim() || !user || !bookId) return;

        setIsSubmitting(true);
        const { error } = await supabase
            .from('notes')
            .insert({
                book_id: bookId,
                content: newNoteContent.trim(),
                created_by: user.id
            });

        if (error) {
            console.error('Error creating note:', error);
            setError('Chyba pri vytváraní poznámky');
        } else {
            setNewNoteContent('');
            setIsModalOpen(false);
            await fetchBookDetails();
        }
        setIsSubmitting(false);
    };

    const handleDeleteNote = (noteId: string) => {
        setShowDeleteNoteDialog(noteId);
    };

    const confirmDeleteNote = async () => {
        if (!showDeleteNoteDialog || !user) return;

        const { error } = await supabase
            .from('notes')
            .delete()
            .eq('id', showDeleteNoteDialog)
            .eq('created_by', user.id);

        if (error) {
            console.error('Error deleting note:', error);
            setError('Chyba pri mazaní poznámky');
        } else {
            await fetchBookDetails();
        }
        setShowDeleteNoteDialog(null);
    };

    const resetForm = () => {
        setNewNoteContent('');
    };

    const closeModal = () => {
        setIsModalOpen(false);
        resetForm();
    };

    const nextPage = () => {
        if (currentPage < filteredPages.length - 1) {
            setCurrentPage(currentPage + 1);
        }
    };

    const prevPage = () => {
        if (currentPage > 0) {
            setCurrentPage(currentPage - 1);
        }
    };

    const goToPage = (pageIndex: number) => {
        setCurrentPage(pageIndex);
    };

    const clearSearch = () => {
        setSearchTerm('');
        setSearchDate('');
    };

    if (loading) {
        return (
            <div className="book-detail-page">
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>Načítavam knihu...</p>
                </div>
            </div>
        );
    }

    if (error || !book) {
        return (
            <div className="book-detail-page">
                <div className="error-container">
                    <p>{error || 'Kniha nebola nájdená'}</p>
                    <button onClick={() => navigate('/books')} className="retry-btn">
                        Späť na oddelenia
                    </button>
                </div>
            </div>
        );
    }

    const currentPageData = filteredPages[currentPage];
    const totalPages = filteredPages.length;

    return (
        <div className="book-detail-page">
            <header className="book-detail-header">
                <div className="book-header-content">
                    <div className="header-text-container">
                        <Link to={`/department/${book.department_id}`} className="back-link">
                            <span>←</span>
                            <span>Späť na oddelenie</span>
                        </Link>
                        <h1>{book.name}</h1>
                        {department && (
                            <p>Oddelenie: {department.name}</p>
                        )}
                        <p>Virtuálna kniha poznámok</p>
                    </div>
                    <div className="book-controls">
                        <button 
                            className="open-book-btn"
                            onClick={() => setIsBookOpen(!isBookOpen)}
                        >
                            {isBookOpen ? 'Zatvoriť knihu' : 'Otvoriť knihu'}
                        </button>
                        {hasPermission('create') && (
                            <button 
                                className="add-note-btn-header"
                                onClick={() => setIsModalOpen(true)}
                            >
                                + Pridať poznámku
                            </button>
                        )}
                    </div>
                </div>

                {/* Search Controls */}
                <div className="search-controls">
                    <div className="search-group">
                        <input
                            type="text"
                            placeholder="Hľadať v poznámkach..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                    </div>
                    <div className="search-group">
                        <input
                            type="date"
                            value={searchDate}
                            onChange={(e) => setSearchDate(e.target.value)}
                            className="date-input"
                        />
                    </div>
                    {(searchTerm || searchDate) && (
                        <button onClick={clearSearch} className="clear-search-btn">
                            Vymazať filtrovanie
                        </button>
                    )}
                </div>
            </header>

            <main className="book-detail-main">
                {!isBookOpen ? (
                    <div className="book-closed-state">
                        <div className="book-cover-closed">
                            <h2>{book.name}</h2>
                            <p>Kliknite na "Otvoriť knihu" pre zobrazenie poznámok</p>
                            <p className="book-stats">
                                {totalPages} strán • {notes.length} poznámok
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="book-container">
                        <div className="book-spine"></div>
                        <div className="book-content">
                            {totalPages === 0 ? (
                                <div className="empty-book">
                                    <div className="empty-book-content">
                                        <h3>Kniha je prázdna</h3>
                                        <p>Začnite písať svoju prvú poznámku</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Page Navigation */}
                                    <div className="page-navigation">
                                        <button 
                                            onClick={prevPage} 
                                            disabled={currentPage === 0}
                                            className="nav-btn prev-btn"
                                        >
                                            ← Predchádzajúca
                                        </button>
                                        <div className="page-info">
                                            Stránka {currentPage + 1} z {totalPages}
                                        </div>
                                        <button 
                                            onClick={nextPage} 
                                            disabled={currentPage === totalPages - 1}
                                            className="nav-btn next-btn"
                                        >
                                            Ďalšia →
                                        </button>
                                    </div>

                                    {/* Current Page */}
                                    {currentPageData && (
                                        <div className="book-page">
                                            <div className="page-header">
                                                <h3>{format(parseISO(currentPageData.date), 'EEEE, d. MMMM yyyy', { locale: sk })}</h3>
                                                <span className="page-number">Stránka {currentPageData.pageNumber}</span>
                                            </div>
                                            <div className="page-content">
                                                {currentPageData.notes.map((note) => (
                                                    <div key={note.id} className="note-entry">
                                                        <div className="note-content">
                                                            <p>{note.content}</p>
                                                        </div>
                                                        <div className="note-footer">
                                                            <span className="note-time">
                                                                {format(parseISO(note.created_at), 'HH:mm', { locale: sk })}
                                                            </span>
                                                            {hasPermission('delete', note) && (
                                                                <button
                                                                    className="delete-note-btn"
                                                                    onClick={() => handleDeleteNote(note.id)}
                                                                    title="Vymazať poznámku"
                                                                >
                                                                    ×
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Page Thumbnails */}
                                    <div className="page-thumbnails">
                                        {filteredPages.map((page, index) => (
                                            <button
                                                key={page.date}
                                                onClick={() => goToPage(index)}
                                                className={`page-thumbnail ${index === currentPage ? 'active' : ''}`}
                                                title={format(parseISO(page.date), 'd. M. yyyy', { locale: sk })}
                                            >
                                                <span className="thumbnail-date">
                                                    {format(parseISO(page.date), 'd.M', { locale: sk })}
                                                </span>
                                                <span className="thumbnail-count">
                                                    {page.notes.length} poznámok
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* Note Modal */}
            {isModalOpen && (
                <div className="note-modal-overlay">
                    <div className="note-modal">
                        <div className="note-modal-header">
                            <h3>Pridať novú poznámku</h3>
                            <button className="note-modal-close" onClick={closeModal}>&times;</button>
                        </div>
                        <form onSubmit={handleCreateNote} className="note-modal-body">
                            <div className="form-group">
                                <label htmlFor="note-content">Poznámka</label>
                                <textarea 
                                    id="note-content" 
                                    className="form-input" 
                                    placeholder="Napíšte svoju poznámku..." 
                                    value={newNoteContent} 
                                    onChange={(e) => setNewNoteContent(e.target.value)} 
                                    rows={6}
                                    autoFocus
                                    required
                                ></textarea>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="modal-button modal-button-secondary" onClick={closeModal}>
                                    Zrušiť
                                </button>
                                <button type="submit" className="modal-button modal-button-primary" disabled={!newNoteContent.trim() || isSubmitting}>
                                    {isSubmitting ? 'Pridávam...' : 'Pridať poznámku'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Confirm Dialogs */}
            <ConfirmDialog
                isOpen={!!showDeleteNoteDialog}
                title="Vymazať poznámku"
                message="Naozaj chcete vymazať túto poznámku? Táto akcia sa nedá vrátiť späť."
                confirmText="Vymazať"
                cancelText="Zrušiť"
                onConfirm={confirmDeleteNote}
                onCancel={() => setShowDeleteNoteDialog(null)}
                type="danger"
            />
        </div>
    );
};

export default BookDetailPage; 