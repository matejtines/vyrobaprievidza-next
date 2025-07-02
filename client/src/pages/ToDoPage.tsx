import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import supabase from '../lib/supabase';
import { useUser } from '../context/UserContext';
import './ToDoPage.css';

interface Topic {
    id: string;
    name: string;
    created_at: string;
}

const ToDoPage: React.FC = () => {
    const { user } = useUser();
    const [topics, setTopics] = useState<Topic[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newTopicName, setNewTopicName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Kontrola oprávnení pre vytváranie tém
    const canCreateTopics = user?.role === 'admin' || 
                           user?.role === 'manager' || 
                           user?.role === 'timlider' ||
                           user?.role === 'managervyroby' ||
                           user?.role === 'managerkvalita' ||
                           user?.role === 'managermechanik';

    const fetchTopics = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('todo_topics')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching topics:', error);
            // TODO: Add user-friendly error handling (e.g., toast)
        } else {
            setTopics(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchTopics();
    }, []);

    const handleCreateTopic = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTopicName.trim() || !user || !canCreateTopics) return;

        setIsSubmitting(true);
        const { error } = await supabase
            .from('todo_topics')
            .insert({ name: newTopicName, created_by: user.id });

        if (error) {
            console.error('Error creating topic:', error);
            // TODO: Add user-friendly error handling
        } else {
            setNewTopicName('');
            setIsModalOpen(false);
            await fetchTopics(); // Re-fetch topics to show the new one
        }
        setIsSubmitting(false);
    };

    return (
        <div className="todo-page-container">
            <header className="todo-page-header">
                <h1>ToDo List</h1>
                <p>Miesto pre správu úloh a projektov.</p>
            </header>
            <main className="todo-page-main">
                <div className="topics-container">
                    <div className="topics-header">
                        <h2>Hlavné témy</h2>
                        {canCreateTopics && (
                            <button className="add-topic-btn" onClick={() => setIsModalOpen(true)}>
                                <span>+</span> Vytvoriť tému
                            </button>
                        )}
                    </div>
                    {loading ? (
                        <p>Načítavam témy...</p>
                    ) : (
                        <div className="topics-list">
                            {topics.map(topic => (
                                <Link to={`/todo/${topic.id}`} key={topic.id} className="topic-card-link">
                                    <div className="topic-card">
                                        <h3>{topic.name}</h3>
                                    </div>
                                </Link>
                            ))}
                            {topics.length === 0 && !loading && (
                                <div className="no-topics-message">
                                    <p>Zatiaľ neboli vytvorené žiadne témy.</p>
                                    {canCreateTopics ? (
                                        <p>Vytvorte prvú kliknutím na tlačidlo vyššie.</p>
                                    ) : (
                                        <p>Kontaktujte administrátora pre vytvorenie témy.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>

            {isModalOpen && canCreateTopics && (
                <div className="todo-modal-overlay">
                    <div className="todo-modal">
                        <div className="todo-modal-header">
                            <h3>Vytvoriť novú tému</h3>
                            <button className="todo-modal-close" onClick={() => setIsModalOpen(false)}>&times;</button>
                        </div>
                        <form onSubmit={handleCreateTopic} className="todo-modal-body">
                            <div className="form-group">
                                <label htmlFor="topic-name">Názov témy</label>
                                <input
                                    id="topic-name"
                                    type="text"
                                    className="form-input"
                                    placeholder="Zadaj názov témy"
                                    value={newTopicName}
                                    onChange={(e) => setNewTopicName(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="modal-button modal-button-secondary" onClick={() => setIsModalOpen(false)}>
                                    Zrušiť
                                </button>
                                <button type="submit" className="modal-button modal-button-primary" disabled={!newTopicName.trim() || isSubmitting}>
                                    {isSubmitting ? 'Ukladám...' : 'Uložiť tému'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ToDoPage; 