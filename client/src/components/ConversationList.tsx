import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import supabase from '../lib/supabase';
import { FaPlus, FaUsers, FaUser } from 'react-icons/fa';
import './ConversationList.css';
import { formatDistanceToNow } from 'date-fns';
import { sk } from 'date-fns/locale';

interface User {
  id: string;
  email: string;
  fullName: string;
}

interface Conversation {
  id: string;
  name: string;
  type: 'direct' | 'group';
  last_message: string;
  last_message_time: string;
  unread_count: number;
  participants: User[];
}

interface ConversationListProps {
  onSelectConversation: (conversationId: string) => void;
  selectedConversationId: string | null;
}

const ConversationList: React.FC<ConversationListProps> = ({
  onSelectConversation,
  selectedConversationId
}) => {
  const { user } = useUser();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isGroupChat, setIsGroupChat] = useState(false);

  useEffect(() => {
    fetchConversations();
    const subscription = supabase
      .channel('conversations_changes')
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'chat_conversations'
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  const fetchConversations = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .rpc('get_user_conversations', {
          p_user_id: user.id
        });

      if (error) throw error;
      
      console.log('Načítané konverzácie:', data);
      setConversations(data || []);
    } catch (error) {
      console.error('Chyba pri načítaní konverzácií:', error);
      setError('Nepodarilo sa načítať konverzácie.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableUsers = async () => {
    if (!user) return;
    
    try {
      setLoadingUsers(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, name, login')
        .order('name', { ascending: true });

      if (error) {
        console.error('Chyba pri načítaní používateľov:', error);
        setError('Nepodarilo sa načítať zoznam používateľov');
        return;
      }

      if (!data) {
        console.log('Žiadni používatelia nenájdení');
        setAvailableUsers([]);
        return;
      }

      const filteredUsers = data
        .filter(profile => profile.id !== user.id)
        .map(profile => ({
          id: profile.id,
          email: profile.email,
          fullName: `${profile.name} ${profile.login}`.trim() || profile.email
        }));

      console.log('Načítaní a vyfiltrovaní používatelia:', filteredUsers);
      setAvailableUsers(filteredUsers);
    } catch (err) {
      console.error('Chyba pri načítaní používateľov:', err);
      setError('Nepodarilo sa načítať zoznam používateľov');
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (showNewConversationModal) {
      fetchAvailableUsers();
    }
  }, [showNewConversationModal]);

  const handleCreateDirectConversation = async (otherUserId: string) => {
    if (!user) return;
    
    try {
      setCreatingConversation(true);
      setError(null);
      
      console.log('Vytváram priamu konverzáciu s používateľom:', otherUserId);
      
      const { data, error } = await supabase
        .rpc('create_direct_conversation', {
          p_user_id: user.id,
          p_other_user_id: otherUserId
        });

      if (error) {
        console.error('Chyba pri volaní create_direct_conversation:', error);
        throw error;
      }
      
      console.log('Vytvorená konverzácia:', data);
      
      if (data) {
        onSelectConversation(data);
        setShowNewConversationModal(false);
        setSelectedUserId(null);
      }
    } catch (error) {
      console.error('Chyba pri vytváraní konverzácie:', error);
      setError('Nepodarilo sa vytvoriť konverzáciu.');
    } finally {
      setCreatingConversation(false);
    }
  };

  const handleCreateGroupConversation = async () => {
    if (!user || selectedUsers.length === 0 || !groupName.trim()) return;

    try {
      setCreatingConversation(true);
      const userIds = selectedUsers.map(u => u.id);
      
      const { data, error } = await supabase
        .rpc('create_group_conversation', {
          p_name: groupName.trim(),
          p_created_by: user.id,
          p_user_ids: userIds
        });

      if (error) {
        console.error('Chyba pri vytváraní skupiny:', error);
        setError('Nepodarilo sa vytvoriť skupinu');
        return;
      }

      await fetchConversations();
      setShowNewConversationModal(false);
      setSelectedUsers([]);
      setGroupName('');
    } catch (err) {
      console.error('Chyba pri vytváraní skupiny:', err);
      setError('Nepodarilo sa vytvoriť skupinu');
    } finally {
      setCreatingConversation(false);
    }
  };

  const handleAddUser = (userId: string) => {
    const user = availableUsers.find(u => u.id === userId);
    if (user && !selectedUsers.some(u => u.id === userId)) {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const handleRemoveUser = (userId: string) => {
    setSelectedUsers(selectedUsers.filter(u => u.id !== userId));
  };

  const formatConversationName = (conversation: Conversation) => {
    if (conversation.type === 'direct') {
      const otherParticipant = conversation.participants.find(p => p.id !== user?.id);
      return otherParticipant ? otherParticipant.fullName : 'Neznámy používateľ';
    }
    return conversation.name;
  };

  if (loading) return <div className="conversation-list-loading">Načítavam konverzácie...</div>;
  if (error) return <div className="conversation-list-error">{error}</div>;

  return (
    <div className="conversation-list">
      <div className="conversation-list-header">
        <h2>Konverzácie</h2>
        <button
          className="new-conversation-button"
          onClick={() => {
            setShowNewConversationModal(true);
            fetchAvailableUsers();
          }}
        >
          <FaPlus />
        </button>
      </div>

      {loading ? (
        <div className="loading">Načítavam konverzácie...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : conversations.length === 0 ? (
        <div className="empty-state">
          Žiadne konverzácie. Začnite novú konverzáciu!
        </div>
      ) : (
        <div className="conversations">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`conversation-item ${
                selectedConversationId === conversation.id ? 'selected' : ''
              }`}
              onClick={() => onSelectConversation(conversation.id)}
            >
              <div className="conversation-header">
                <h3 className="conversation-name">{formatConversationName(conversation)}</h3>
                <span className="conversation-time">
                  {conversation.last_message_time ? formatDistanceToNow(new Date(conversation.last_message_time), { addSuffix: true, locale: sk }) : ''}
                </span>
              </div>
              <div className="conversation-last-message">{conversation.last_message || 'Žiadne správy'}</div>
              <div className="conversation-footer">
                <div className="conversation-participants">
                  {conversation.type === 'group' 
                    ? `${conversation.participants.length} účastníkov`
                    : conversation.participants.find(p => p.id !== user?.id)?.fullName || 'Neznámy používateľ'
                  }
                </div>
                {conversation.unread_count > 0 && (
                  <div className="unread-badge">{conversation.unread_count}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showNewConversationModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Nova konverzácia</h3>
              <button 
                className="close-button"
                onClick={() => {
                  setShowNewConversationModal(false);
                  setSelectedUserId(null);
                  setSelectedUserIds([]);
                  setGroupName('');
                  setError(null);
                }}
              >
                ×
              </button>
            </div>

            <div className="modal-tabs">
              <button
                className={`tab-button ${!isGroupChat ? 'active' : ''}`}
                onClick={() => setIsGroupChat(false)}
              >
                Priama konverzácia
              </button>
              <button
                className={`tab-button ${isGroupChat ? 'active' : ''}`}
                onClick={() => setIsGroupChat(true)}
              >
                Skupinová konverzácia
              </button>
            </div>

            {error && <div className="error-message">{error}</div>}

            {!isGroupChat ? (
              <div className="user-selection">
                <h4>Vyberte používateľa</h4>
                {loadingUsers ? (
                  <div className="loading">Načítavam používateľov...</div>
                ) : (
                  <div className="user-list">
                    {availableUsers.map((user) => (
                      <div
                        key={user.id}
                        className={`user-item ${selectedUserId === user.id ? 'selected' : ''}`}
                        onClick={() => setSelectedUserId(user.id)}
                      >
                        <div className="user-avatar">
                          {user.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="user-info">
                          <div className="user-name">{user.fullName}</div>
                          <div className="user-email">{user.email}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  className="create-button"
                  onClick={() => selectedUserId && handleCreateDirectConversation(selectedUserId)}
                  disabled={!selectedUserId || creatingConversation}
                >
                  {creatingConversation ? 'Vytváram...' : 'Vytvoriť konverzáciu'}
                </button>
              </div>
            ) : (
              <div className="group-creation">
                <div className="group-name-input">
                  <label htmlFor="groupName">Názov skupiny</label>
                  <input
                    id="groupName"
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Zadajte názov skupiny"
                  />
                </div>
                <div className="user-selection">
                  <h4>Vyberte účastníkov</h4>
                  {loadingUsers ? (
                    <div className="loading">Načítavam používateľov...</div>
                  ) : (
                    <div className="user-list">
                      {availableUsers.map((user) => (
                        <div
                          key={user.id}
                          className={`user-item ${selectedUserIds.includes(user.id) ? 'selected' : ''}`}
                          onClick={() => {
                            setSelectedUserIds(prev => 
                              prev.includes(user.id)
                                ? prev.filter(id => id !== user.id)
                                : [...prev, user.id]
                            );
                          }}
                        >
                          <div className="user-avatar">
                            {user.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div className="user-info">
                            <div className="user-name">{user.fullName}</div>
                            <div className="user-email">{user.email}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    className="create-button"
                    onClick={handleCreateGroupConversation}
                    disabled={!groupName.trim() || selectedUserIds.length === 0 || creatingConversation}
                  >
                    {creatingConversation ? 'Vytváram...' : 'Vytvoriť skupinu'}
                  </button>
                </div>
                {selectedUsers.map(user => (
                  <div key={user.id} className="selected-user-tag">
                    <div className="user-name">{user.fullName}</div>
                    <button
                      className="remove-user-button"
                      onClick={() => handleRemoveUser(user.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversationList; 