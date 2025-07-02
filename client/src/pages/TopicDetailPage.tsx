import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import supabase from '../lib/supabase';
import { useUser } from '../context/UserContext';
import './TopicDetailPage.css';
import { format } from 'date-fns';
import { sk } from 'date-fns/locale';
import ConfirmDialog from '../components/ConfirmDialog';

interface Topic {
    id: string;
    name: string;
}

interface Attachment {
    id: string;
    file_name: string;
    file_path: string;
    file_type?: string | null;
}

interface ToDoItem {
    id: string;
    title: string;
    description: string | null;
    status: string;
    flags: string[] | null;
    due_date: string | null;
    created_by: string | null;
    todo_attachments: Attachment[];
}

interface Comment {
    id: string;
    comment_text: string;
    created_at: string;
    created_by: string | null;
    login: string | null;
    name: string | null;
    attachment_url?: string | null;
    attachment_name?: string | null;
    attachment_type?: string | null;
}

const statusOptions = ['Nové', 'V riešení', 'Vyriešené', 'Vyžaduje čas', 'Nevyriešiteľné'];
const flagOptions = ['Nebezpečný', 'Vysoko nebezpečný', 'Urgentný'];

const TopicDetailPage: React.FC = () => {
    const { topicId } = useParams<{ topicId: string }>();
    const { user } = useUser();
    const [topic, setTopic] = useState<Topic | null>(null);
    const [items, setItems] = useState<ToDoItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Form state
    const [newItemTitle, setNewItemTitle] = useState('');
    const [newItemDescription, setNewItemDescription] = useState('');
    const [newItemDueDate, setNewItemDueDate] = useState('');
    const [selectedFlags, setSelectedFlags] = useState<string[]>([]);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const [selectedItem, setSelectedItem] = useState<ToDoItem | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(false);

    const [comments, setComments] = useState<Comment[]>([]);
    const [loadingComments, setLoadingComments] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [postingComment, setPostingComment] = useState(false);
    const [deletingComment, setDeletingComment] = useState<string | null>(null);
    const [deletingTopic, setDeletingTopic] = useState(false);
    const [deletingItem, setDeletingItem] = useState<string | null>(null);
    const [commentAttachment, setCommentAttachment] = useState<File | null>(null);
    const commentFileInputRef = React.useRef<HTMLInputElement>(null);

    const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
    const [selectedImageName, setSelectedImageName] = useState<string | null>(null);

    // Confirm dialog states
    const [showDeleteTopicDialog, setShowDeleteTopicDialog] = useState(false);
    const [showDeleteItemDialog, setShowDeleteItemDialog] = useState<string | null>(null);
    const [showDeleteCommentDialog, setShowDeleteCommentDialog] = useState<string | null>(null);

    const navigate = useNavigate();

    // Kontrola oprávnení pre vytváranie úloh
    const canCreateItems = user?.role === 'admin' || 
                          user?.role === 'manager' || 
                          user?.role === 'timlider' ||
                          user?.role === 'managervyroby' ||
                          user?.role === 'managerkvalita' ||
                          user?.role === 'managermechanik';

    // Kontrola oprávnení pre mazanie tém
    const canDeleteTopics = user?.role === 'admin' || user?.role === 'manager';

    // Kontrola oprávnení pre mazanie úloh
    const canDeleteItems = user?.role === 'admin' || user?.role === 'manager';

    const fetchTopicDetails = async () => {
        if (!topicId) return;
        setLoading(true);
        
        const { data: topicData, error: topicError } = await supabase
            .from('todo_topics').select('id, name').eq('id', topicId).single();

        if (topicError) console.error('Error fetching topic details:', topicError);
        else setTopic(topicData);

        const { data: itemsData, error: itemsError } = await supabase
            .from('todo_items')
            .select('*, todo_attachments(id, file_name, file_path, file_type), created_by')
            .eq('topic_id', topicId)
            .order('created_at', { ascending: false });

        if (itemsError) {
            console.error('Error fetching todo items:', itemsError);
        } else {
            setItems(itemsData);
        }

        setLoading(false);
    };

    useEffect(() => {
        fetchTopicDetails();
    }, [topicId]);
    
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleCreateItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItemTitle.trim() || !user || !topicId || !canCreateItems) return;

        setIsSubmitting(true);
        let attachmentPath: string | null = null;
        let attachmentName: string | null = null;
        let attachmentType: string | null = null;

        // 1. Upload file if selected
        if (selectedFile) {
            const fileExt = selectedFile.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${user.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('todoattachments')
                .upload(filePath, selectedFile);

            if (uploadError) {
                console.error('Error uploading file:', uploadError);
                // TODO: Add user-friendly error handling
                setIsSubmitting(false);
                return;
            }
            attachmentPath = filePath;
            attachmentName = selectedFile.name;
            attachmentType = selectedFile.type;
        }

        // 2. Insert the new ToDo item
        const { data: newItem, error: itemError } = await supabase
            .from('todo_items')
            .insert({
                topic_id: topicId,
                title: newItemTitle,
                description: newItemDescription,
                due_date: newItemDueDate || null,
                flags: selectedFlags,
                created_by: user.id,
                status: 'Nové'
            })
            .select()
            .single();

        if (itemError) {
            console.error('Error creating item:', itemError);
            // TODO: Add user-friendly error handling
            setIsSubmitting(false);
            return;
        }
        
        // 3. If attachment was uploaded, insert into todo_attachments table
        if (attachmentPath && newItem) {
            const { error: attachmentError } = await supabase
                .from('todo_attachments')
                .insert({
                    item_id: newItem.id,
                    file_path: attachmentPath,
                    file_name: attachmentName,
                    file_type: attachmentType,
                    uploaded_by: user.id,
                });

            if (attachmentError) {
                console.error('Error creating attachment record:', attachmentError);
                // TODO: Add user-friendly error handling
            }
        }

        // 4. Reset form and close modal
        setNewItemTitle('');
        setNewItemDescription('');
        setNewItemDueDate('');
        setSelectedFlags([]);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setIsModalOpen(false);
        setIsSubmitting(false);

        // 5. Refresh the items list
        await fetchTopicDetails();
    };
    
    const handleFlagChange = (flag: string) => {
        setSelectedFlags(prev =>
            prev.includes(flag) ? prev.filter(f => f !== flag) : [...prev, flag]
        );
    };

    const handleDownload = async (filePath: string, fileName: string) => {
        try {
            const { data, error } = await supabase.storage
                .from('todoattachments')
                .download(filePath);
            
            if (error) {
                throw error;
            }

            const blob = new Blob([data]);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading file:', error);
            // TODO: Add user-friendly error toast
        }
    };

    const fetchComments = async (itemId: string) => {
        setLoadingComments(true);
        const { data, error } = await supabase
            .from('todo_comments_with_profiles')
            .select(`
                id,
                comment_text,
                created_at,
                created_by,
                login,
                name,
                attachment_url,
                attachment_name,
                attachment_type
            `)
            .eq('item_id', itemId)
            .order('created_at', { ascending: true });
        
        if (error) {
            console.error('Error fetching comments:', error);
        } else if (data) {
            setComments(data);
        }
        setLoadingComments(false);
    };

    const openDetailModal = (item: ToDoItem) => {
        setSelectedItem(item);
        setIsDetailModalOpen(true);
        fetchComments(item.id);
    };

    const closeDetailModal = () => {
        setSelectedItem(null);
        setIsDetailModalOpen(false);
        setComments([]); // Clear comments on close
    };

    const handleCommentFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setCommentAttachment(e.target.files[0]);
        }
    };

    const handlePostComment = async () => {
        if (!newComment.trim() || !selectedItem || !user) return;

        setPostingComment(true);
        let attachmentPath: string | null = null;
        let attachmentName: string | null = null;
        let attachmentType: string | null = null;

        // 1. Upload attachment if selected
        if (commentAttachment) {
            const fileExt = commentAttachment.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `comments/${user.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('chat-attachments')
                .upload(filePath, commentAttachment);

            if (uploadError) {
                console.error('Error uploading comment attachment:', uploadError);
                alert('Chyba pri nahrávaní prílohy. Skúste to znova.');
                setPostingComment(false);
                return;
            }
            attachmentPath = filePath;
            attachmentName = commentAttachment.name;
            attachmentType = commentAttachment.type;
        }

        // 2. Insert the comment
        const { error } = await supabase
            .from('todo_comments')
            .insert({
                item_id: selectedItem.id,
                comment_text: newComment,
                created_by: user.id,
                attachment_url: attachmentPath,
                attachment_name: attachmentName,
                attachment_type: attachmentType
            });

        if (error) {
            console.error('Error posting comment:', error);
        } else {
            setNewComment('');
            setCommentAttachment(null);
            if (commentFileInputRef.current) commentFileInputRef.current.value = "";
            await fetchComments(selectedItem.id); // Re-fetch to get the new comment
        }
        setPostingComment(false);
    };

    const handleStatusChange = async (newStatus: string) => {
        if (!selectedItem) return;

        setUpdatingStatus(true);
        const { error } = await supabase
            .from('todo_items')
            .update({ status: newStatus })
            .eq('id', selectedItem.id);

        if (error) {
            console.error('Error updating status:', error);
            // TODO: Add user-friendly error handling
        } else {
            // Update the status locally to provide immediate feedback
            setSelectedItem(prev => prev ? { ...prev, status: newStatus } : null);
            // Also update the list view in the background
            setItems(prevItems =>
                prevItems.map(item =>
                    item.id === selectedItem.id ? { ...item, status: newStatus } : item
                )
            );
        }
        setUpdatingStatus(false);
    };

    const handleDeleteTopic = () => {
        if (!canDeleteTopics) return;
        setShowDeleteTopicDialog(true);
    };

    const confirmDeleteTopic = async () => {
        if (!topicId || !user || !canDeleteTopics) return;
        
        setDeletingTopic(true);
        const { error } = await supabase
            .from('todo_topics')
            .delete()
            .eq('id', topicId)
            .eq('created_by', user.id);

        if (error) {
            console.error('Error deleting topic:', error);
        } else {
            navigate('/todo');
        }
        setDeletingTopic(false);
        setShowDeleteTopicDialog(false);
    };

    const handleDeleteItem = (itemId: string) => {
        if (!canDeleteItems && items.find(item => item.id === itemId)?.created_by !== user?.id) return;
        setShowDeleteItemDialog(itemId);
    };

    const confirmDeleteItem = async () => {
        if (!showDeleteItemDialog || !user) return;
        
        setDeletingItem(showDeleteItemDialog);
        const { error } = await supabase
            .from('todo_items')
            .delete()
            .eq('id', showDeleteItemDialog)
            .eq('created_by', user.id);

        if (error) {
            console.error('Error deleting item:', error);
        } else {
            await fetchTopicDetails();
        }
        setDeletingItem(null);
        setShowDeleteItemDialog(null);
    };

    const handleDeleteComment = (commentId: string) => {
        setShowDeleteCommentDialog(commentId);
    };

    const confirmDeleteComment = async () => {
        if (!showDeleteCommentDialog || !user) return;
        
        setDeletingComment(showDeleteCommentDialog);
        const { error } = await supabase
            .from('todo_comments')
            .delete()
            .eq('id', showDeleteCommentDialog)
            .eq('created_by', user.id);

        if (error) {
            console.error('Error deleting comment:', error);
        } else if (selectedItem) {
            await fetchComments(selectedItem.id);
        }
        setDeletingComment(null);
        setShowDeleteCommentDialog(null);
    };

    const handleRemoveFile = () => {
        setSelectedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const resetForm = () => {
        setNewItemTitle('');
        setNewItemDescription('');
        setNewItemDueDate('');
        setSelectedFlags([]);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const closeModal = () => {
        setIsModalOpen(false);
        resetForm();
    };

    if (loading) {
        return <div className="loading-container">Načítavam...</div>;
    }

    if (!topic) {
        return <div className="error-container">Téma nebola nájdená.</div>;
    }

    return (
        <div className="topic-detail-page">
            <header className="topic-detail-header">
                <Link to="/todo" className="back-link">&larr; Späť na témy</Link>
                <div className="topic-header-content">
                    <div>
                        <h1>{topic.name}</h1>
                        <p>Zoznam úloh a ich stav.</p>
                    </div>
                    {canDeleteTopics && (
                        <button
                            className="delete-topic-btn"
                            onClick={handleDeleteTopic}
                            disabled={deletingTopic}
                            title="Vymazať tému"
                        >
                            {deletingTopic ? 'Mazanie...' : 'Vymazať tému'}
                        </button>
                    )}
                </div>
            </header>
            <main className="topic-detail-main">
                <div className="items-container">
                    <div className="items-header">
                        <h2>Úlohy</h2>
                        {canCreateItems && (
                            <button className="add-item-btn" onClick={() => setIsModalOpen(true)}>
                                <span>+</span> Pridať úlohu
                            </button>
                        )}
                    </div>
                    <div className="items-list">
                        {items.length > 0 ? items.map(item => (
                            <div key={item.id} className="item-card" onClick={() => openDetailModal(item)}>
                                <div className="item-card-header">
                                    <h3 className="item-title">{item.title}</h3>
                                    <div className="item-header-actions">
                                        <span className={`status-badge status-${item.status.toLowerCase().replace(/\s+/g, '-')}`}>
                                            {item.status}
                                        </span>
                                        {(canDeleteItems || item.created_by === user?.id) && (
                                            <button
                                                className="delete-item-btn"
                                                onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }}
                                                disabled={deletingItem === item.id}
                                                title="Vymazať úlohu"
                                            >
                                                {deletingItem === item.id ? '...' : '×'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {item.description && <p className="item-description">{item.description}</p>}
                                
                                {/* Attachments Section */}
                                {item.todo_attachments && item.todo_attachments.length > 0 && (
                                    <div className="item-attachments">
                                        {item.todo_attachments.map(att => (
                                            <div key={att.id} className="attachment-chip">
                                                {att.file_type?.startsWith('image/') ? (
                                                    <div className="attachment-preview">
                                                        <img
                                                            src={`${supabase.storage.from('todoattachments').getPublicUrl(att.file_path).data.publicUrl}`}
                                                            alt={att.file_name}
                                                            className="attachment-thumbnail"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedImageUrl(supabase.storage.from('todoattachments').getPublicUrl(att.file_path).data.publicUrl);
                                                                setSelectedImageName(att.file_name);
                                                            }}
                                                        />
                                                        <span className="attachment-name">{att.file_name}</span>
                                                    </div>
                                                ) : (
                                                    <span className="attachment-name">{att.file_name}</span>
                                                )}
                                                <button onClick={(e) => { e.stopPropagation(); handleDownload(att.file_path, att.file_name); }} className="download-btn">
                                                    Stiahnuť
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="item-card-footer">
                                    <div className="item-flags">
                                        {item.flags?.map(flag => (
                                            <span key={flag} className={`flag-badge flag-${flag.toLowerCase().replace(/\s+/g, '-')}`}>
                                                {flag}
                                            </span>
                                        ))}
                                    </div>
                                    {item.due_date && (
                                        <span className="item-due-date">
                                            Termín: {format(new Date(item.due_date), 'd. M. yyyy', { locale: sk })}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )) : (
                            <div className="no-items-message">
                                <p>V tejto téme zatiaľ nie sú žiadne úlohy.</p>
                                {canCreateItems ? (
                                    <p>Pridajte prvú úlohu kliknutím na tlačidlo vyššie.</p>
                                ) : (
                                    <p>Kontaktujte administrátora pre pridanie úlohy.</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Modal pre pridanie novej úlohy */}
            {isModalOpen && canCreateItems && (
                <div className="todo-modal-overlay">
                    <div className="todo-modal">
                        <div className="todo-modal-header">
                            <h3>Pridať novú úlohu</h3>
                            <button className="todo-modal-close" onClick={closeModal}>&times;</button>
                        </div>
                        <form onSubmit={handleCreateItem} className="todo-modal-body">
                            <div className="form-group">
                                <label htmlFor="item-title">Názov úlohy</label>
                                <input
                                    id="item-title"
                                    type="text"
                                    className="form-input"
                                    placeholder="Zadaj názov úlohy"
                                    value={newItemTitle}
                                    onChange={(e) => setNewItemTitle(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="item-description">Popis</label>
                                <textarea
                                    id="item-description"
                                    className="form-input"
                                    placeholder="Zadaj popis úlohy (voliteľné)"
                                    value={newItemDescription}
                                    onChange={(e) => setNewItemDescription(e.target.value)}
                                    rows={3}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="item-due-date">Termín</label>
                                <input
                                    id="item-due-date"
                                    type="date"
                                    className="form-input"
                                    value={newItemDueDate}
                                    onChange={(e) => setNewItemDueDate(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label>Príznaky</label>
                                <div className="flags-container">
                                    {flagOptions.map(flag => (
                                        <label key={flag} className="flag-checkbox">
                                            <input
                                                type="checkbox"
                                                checked={selectedFlags.includes(flag)}
                                                onChange={() => handleFlagChange(flag)}
                                            />
                                            <span className="flag-label">{flag}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="form-group">
                                <label htmlFor="item-file">Príloha</label>
                                <input
                                    id="item-file"
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileSelect}
                                    accept="image/*,.pdf,.doc,.docx,.txt"
                                />
                                {selectedFile && (
                                    <div className="selected-file">
                                        <span>{selectedFile.name}</span>
                                        <button type="button" onClick={handleRemoveFile} className="remove-file-btn">
                                            ×
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="modal-button modal-button-secondary" onClick={closeModal}>
                                    Zrušiť
                                </button>
                                <button type="submit" className="modal-button modal-button-primary" disabled={!newItemTitle.trim() || isSubmitting}>
                                    {isSubmitting ? 'Ukladám...' : 'Uložiť úlohu'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal pre detail úlohy */}
            {isDetailModalOpen && selectedItem && (
                <div className="todo-modal-overlay">
                    <div className="todo-modal">
                        <div className="todo-modal-header">
                            <h3>{selectedItem.title}</h3>
                            <button className="todo-modal-close" onClick={closeDetailModal}>&times;</button>
                        </div>
                        <div className="todo-modal-body">
                            <div className="detail-section">
                                <h4 className="detail-section-title">Status</h4>
                                <select 
                                    className="status-select"
                                    value={selectedItem.status}
                                    onChange={(e) => handleStatusChange(e.target.value)}
                                    disabled={updatingStatus}
                                >
                                    {statusOptions.map(status => (
                                        <option key={status} value={status}>{status}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="detail-section">
                                <h4 className="detail-section-title">Popis</h4>
                                <p className="item-description-detail">{selectedItem.description || 'Žiadny popis.'}</p>
                            </div>
                            <div className="detail-section">
                                <h4 className="detail-section-title">Komentáre</h4>
                                <div className="comments-list">
                                    {loadingComments ? (
                                        <p>Načítavam komentáre...</p>
                                    ) : comments.length > 0 ? (
                                        comments.map(comment => (
                                            <div key={comment.id} className="comment-item">
                                                <div className="comment-header">
                                                    <span className="comment-author">
                                                        {comment.login && comment.name 
                                                            ? `${comment.login} ${comment.name}` 
                                                            : comment.login || comment.name || 'Anonym'
                                                        }
                                                    </span>
                                                    <div className="comment-actions">
                                                        <span className="comment-time">{format(new Date(comment.created_at), 'd.M.yyyy HH:mm', { locale: sk })}</span>
                                                        {comment.created_by === user?.id && (
                                                            <button
                                                                className="delete-comment-btn"
                                                                onClick={() => handleDeleteComment(comment.id)}
                                                                disabled={deletingComment === comment.id}
                                                                title="Vymazať komentár"
                                                            >
                                                                {deletingComment === comment.id ? '...' : '×'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                <p className="comment-text">{comment.comment_text}</p>
                                                {comment.attachment_url && (
                                                    <div className="comment-attachment">
                                                        {comment.attachment_type?.startsWith('image/') ? (
                                                            <img 
                                                                src={`${supabase.storage.from('chat-attachments').getPublicUrl(comment.attachment_url).data.publicUrl}`}
                                                                alt={comment.attachment_name || 'Obrázok'}
                                                                className="comment-attachment-image"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    window.open(`${supabase.storage.from('chat-attachments').getPublicUrl(comment.attachment_url!).data.publicUrl}`, '_blank');
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className="comment-attachment-file">
                                                                <span>{comment.attachment_name}</span>
                                                                <button 
                                                                    className="download-attachment-btn"
                                                                    onClick={() => {
                                                                        const url = supabase.storage.from('chat-attachments').getPublicUrl(comment.attachment_url!).data.publicUrl;
                                                                        const a = document.createElement('a');
                                                                        a.href = url;
                                                                        a.download = comment.attachment_name || 'súbor';
                                                                        a.click();
                                                                    }}
                                                                >
                                                                    Stiahnuť
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <p className="no-comments-message">Zatiaľ žiadne komentáre.</p>
                                    )}
                                </div>
                                <div className="new-comment-form">
                                    <textarea
                                        className="form-input"
                                        placeholder="Napíšte komentár..."
                                        rows={3}
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        disabled={postingComment}
                                    />
                                    <div className="comment-attachment-input">
                                        <input 
                                            type="file" 
                                            ref={commentFileInputRef} 
                                            onChange={handleCommentFileSelect} 
                                            style={{ display: 'none' }} 
                                            accept="image/*,.pdf,.doc,.docx,.txt"
                                        />
                                        <button 
                                            type="button" 
                                            className="attachment-btn" 
                                            onClick={() => commentFileInputRef.current?.click()}
                                            disabled={postingComment}
                                        >
                                            📎 Príloha
                                        </button>
                                        {commentAttachment && (
                                            <span className="selected-attachment-name">
                                                {commentAttachment.name}
                                                <button 
                                                    type="button" 
                                                    className="remove-attachment-btn"
                                                    onClick={() => {
                                                        setCommentAttachment(null);
                                                        if (commentFileInputRef.current) commentFileInputRef.current.value = "";
                                                    }}
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        className="modal-button modal-button-primary"
                                        onClick={handlePostComment}
                                        disabled={!newComment.trim() || postingComment}
                                    >
                                        {postingComment ? 'Odosielam...' : 'Odoslať'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Lightbox modal pre obrázok */}
            {selectedImageUrl && (
                <div className="image-lightbox-overlay" onClick={() => setSelectedImageUrl(null)}>
                    <div className="image-lightbox-modal" onClick={e => e.stopPropagation()}>
                        <button className="image-lightbox-close" onClick={() => setSelectedImageUrl(null)}>&times;</button>
                        <img src={selectedImageUrl} alt={selectedImageName || ''} className="image-lightbox-img" />
                        {selectedImageName && <div className="image-lightbox-caption">{selectedImageName}</div>}
                    </div>
                </div>
            )}

            {/* Confirm Dialogs */}
            <ConfirmDialog
                isOpen={showDeleteTopicDialog}
                title="Vymazať tému"
                message={`Naozaj chcete vymazať tému "${topic?.name}"? Táto akcia sa nedá vrátiť späť a vymaže všetky úlohy a komentáre.`}
                confirmText="Vymazať"
                cancelText="Zrušiť"
                onConfirm={confirmDeleteTopic}
                onCancel={() => setShowDeleteTopicDialog(false)}
                type="danger"
            />

            <ConfirmDialog
                isOpen={!!showDeleteItemDialog}
                title="Vymazať úlohu"
                message="Naozaj chcete vymazať túto úlohu? Táto akcia sa nedá vrátiť späť."
                confirmText="Vymazať"
                cancelText="Zrušiť"
                onConfirm={confirmDeleteItem}
                onCancel={() => setShowDeleteItemDialog(null)}
                type="danger"
            />

            <ConfirmDialog
                isOpen={!!showDeleteCommentDialog}
                title="Vymazať komentár"
                message="Naozaj chcete vymazať tento komentár? Táto akcia sa nedá vrátiť späť."
                confirmText="Vymazať"
                cancelText="Zrušiť"
                onConfirm={confirmDeleteComment}
                onCancel={() => setShowDeleteCommentDialog(null)}
                type="danger"
            />

            {/* Tlačidlo Späť na konci stránky */}
            <div className="bottom-back-section">
                <Link to="/todo" className="bottom-back-btn">
                    &larr; Späť na zoznam tém
                </Link>
            </div>
        </div>
    );
};

export default TopicDetailPage; 