import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import './BookmarksPage.css';
import { format } from 'date-fns';
import { sk } from 'date-fns/locale';
import ConfirmDialog from '../components/ConfirmDialog';

interface Book {
    id: string;
    name: string;
    created_at: string;
    created_by: string | null;
}

const BookmarksPage: React.FC = () => {
    const { user } = useUser();
    const [books, setBooks] = useState<Book[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal states
    const [isBookModalOpen, setIsBookModalOpen] = useState(false);
    const [newBookName, setNewBookName] = useState('');
    const [isSubmittingBook, setIsSubmittingBook] = useState(false);

    // Delete dialog states
    const [showDeleteBookDialog, setShowDeleteBookDialog] = useState<string | null>(null);

    // Kontrola oprávnení pre vytváranie kníh
    const canCreateBooks = user?.role === 'admin' || 
                          user?.role === 'manager' || 
                          user?.role === 'timlider' ||
                          user?.role === 'managervyroby' ||
                          user?.role === 'managerkvalita' ||
                          user?.role === 'managermechanik';

    // Kontrola oprávnení pre mazanie kníh
    const canDeleteBooks = user?.role === 'admin' || user?.role === 'manager';

    const fetchBooks = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('books')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.error('Error fetching books:', error);
            setError('Chyba pri načítaní kníh');
        } else {
            setBooks(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchBooks();
    }, []);

    const handleCreateBook = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newBookName.trim() || !user || !canCreateBooks) return;

        setIsSubmittingBook(true);
        const { error } = await supabase
            .from('books')
            .insert({
                name: newBookName.trim(),
                created_by: user.id
            });

        if (error) {
            console.error('Error creating book:', error);
            setError('Chyba pri vytváraní knihy');
        } else {
            setNewBookName('');
            setIsBookModalOpen(false);
            await fetchBooks();
        }
        setIsSubmittingBook(false);
    };

    const handleDeleteBook = (bookId: string) => {
        setShowDeleteBookDialog(bookId);
    };

    const confirmDeleteBook = async () => {
        if (!showDeleteBookDialog || !user) return;

        const { error } = await supabase
            .from('books')
            .delete()
            .eq('id', showDeleteBookDialog)
            .eq('created_by', user.id);

        if (error) {
            console.error('Error deleting book:', error);
            setError('Chyba pri mazaní knihy');
        } else {
            await fetchBooks();
        }
        setShowDeleteBookDialog(null);
    };

    const resetBookForm = () => {
        setNewBookName('');
    };

    const closeBookModal = () => {
        setIsBookModalOpen(false);
        resetBookForm();
    };

    if (loading) {
        return (
            <div className="bookmarks-page">
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>Načítavam knihy...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bookmarks-page">
                <div className="error-container">
                    <p>{error}</p>
                    <button onClick={fetchBooks} className="retry-btn">Skúsiť znova</button>
                </div>
            </div>
        );
    }

    return (
        <div className="bookmarks-page">
            <header className="bookmarks-header">
                <div className="bookmarks-header-content">
                    <h1>Odkazy a poznámky</h1>
                    <p>Virtuálne knihy pre zdieľanie informácií</p>
                </div>
            </header>

            <main className="bookmarks-main">
                <div className="books-container">
                    <div className="books-header">
                        <h2>Knihy</h2>
                        {canCreateBooks && (
                            <button 
                                className="add-book-btn" 
                                onClick={() => setIsBookModalOpen(true)}
                            >
                                <span>+</span> Vytvoriť knihu
                            </button>
                        )}
                    </div>

                    <div className="books-list">
                        {books.length > 0 ? (
                            books.map(book => (
                                <div key={book.id} className="book-card">
                                    <div className="book-card-content">
                                        <Link to={`/books/${book.id}`} className="book-link">
                                            <h3 className="book-name">{book.name}</h3>
                                            <p className="book-info">
                                                Vytvorené: {format(new Date(book.created_at), 'd. M. yyyy', { locale: sk })}
                                            </p>
                                        </Link>
                                        <div className="book-actions">
                                            {(canDeleteBooks || book.created_by === user?.id) && (
                                                <button
                                                    className="delete-book-btn"
                                                    onClick={() => handleDeleteBook(book.id)}
                                                    disabled={!canDeleteBooks && book.created_by !== user?.id}
                                                    title={!canDeleteBooks && book.created_by !== user?.id ? "Môžete mazať len svoje knihy" : "Vymazať knihu"}
                                                >
                                                    Vymazať
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="no-books-message">
                                <p>Zatiaľ nie sú vytvorené žiadne knihy.</p>
                                {canCreateBooks ? (
                                    <p>Vytvorte prvú kliknutím na tlačidlo vyššie.</p>
                                ) : (
                                    <p>Kontaktujte administrátora pre vytvorenie knihy.</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Book Modal */}
            {isBookModalOpen && canCreateBooks && (
                <div className="book-modal-overlay">
                    <div className="book-modal">
                        <div className="book-modal-header">
                            <h3>Vytvoriť novú knihu</h3>
                            <button className="book-modal-close" onClick={closeBookModal}>&times;</button>
                        </div>
                        <form onSubmit={handleCreateBook} className="book-modal-body">
                            <div className="form-group">
                                <label htmlFor="book-name">Názov knihy</label>
                                <input 
                                    id="book-name" 
                                    type="text" 
                                    className="form-input" 
                                    placeholder="Zadaj názov knihy" 
                                    value={newBookName} 
                                    onChange={(e) => setNewBookName(e.target.value)} 
                                    autoFocus 
                                    required 
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="modal-button modal-button-secondary" onClick={closeBookModal}>
                                    Zrušiť
                                </button>
                                <button type="submit" className="modal-button modal-button-primary" disabled={!newBookName.trim() || isSubmittingBook}>
                                    {isSubmittingBook ? 'Ukladám...' : 'Uložiť knihu'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmDialog
                isOpen={!!showDeleteBookDialog}
                title="Vymazať knihu"
                message="Naozaj chcete vymazať túto knihu? Všetky zložky a poznámky budú tiež vymazané."
                confirmText="Vymazať"
                cancelText="Zrušiť"
                onConfirm={confirmDeleteBook}
                onCancel={() => setShowDeleteBookDialog(null)}
                type="danger"
            />
        </div>
    );
};

export default BookmarksPage; 