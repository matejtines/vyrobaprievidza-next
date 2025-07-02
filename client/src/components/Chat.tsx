import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '../context/UserContext';
import supabase from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { format, formatDistanceToNow } from 'date-fns';
import { sk } from 'date-fns/locale';
import {
    Box,
    VStack,
    HStack,
    Text,
    Input,
    Button,
    useToast,
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalCloseButton,
    useDisclosure,
    FormControl,
    FormLabel,
    ModalFooter,
    Icon,
    Popover,
    PopoverTrigger,
    PopoverContent,
    PopoverBody,
    List,
    ListItem,
} from '@chakra-ui/react';
import { FiMoreVertical, FiPlus, FiSend, FiUsers, FiEdit2, FiTrash2, FiX, FiPaperclip, FiDownload } from 'react-icons/fi';
import { FaCheck } from 'react-icons/fa';
import './Chat.css';

interface Message {
    id: string;
    content: string;
    created_at: string;
    user_id: string;
    user_name: string;
    reply_to_id?: string;
    reply_to?: {
        content: string;
        user_name: string;
    };
    reactions: Record<string, string[]>;
    attachment_url?: string;
    attachment_name?: string;
    attachment_type?: string;
}

interface Conversation {
    id: string;
    name: string | null;
    type: 'direct' | 'group';
    last_message_at: string | null;
    last_message_text: string | null;
    last_message_sender_id: string | null;
    participants: {
        user_id: string;
        user_name: string;
        role: 'member' | 'admin';
    }[];
    unread_count: number;
}

interface Participant {
    id: string;
    email: string;
    name: string;
    login: string;
    fullName: string;
}

export const Chat: React.FC = () => {
    const { user } = useUser();
    const toast = useToast();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [availableUsers, setAvailableUsers] = useState<Participant[]>([]);
    const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout>();
    const channelRef = useRef<RealtimeChannel | null>(null);
    
    const { isOpen: isNewChatOpen, onOpen: onNewChatOpen, onClose: onNewChatClose } = useDisclosure();
    const { isOpen: isGroupChatOpen, onOpen: onGroupChatOpen, onClose: onGroupChatClose } = useDisclosure();
    const [newGroupName, setNewGroupName] = useState('');
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [showChatMenu, setShowChatMenu] = useState(false);
    const [showAddParticipantsModal, setShowAddParticipantsModal] = useState(false);
    const [isGroupChat, setIsGroupChat] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [showNewConversationModal, setShowNewConversationModal] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadingFile, setUploadingFile] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [imageModal, setImageModal] = useState<{ isOpen: boolean; imageUrl: string; imageName: string }>({
        isOpen: false,
        imageUrl: '',
        imageName: ''
    });

    // Načítanie konverzácií
    useEffect(() => {
        if (user) {
            fetchConversations();
            fetchAvailableUsers();
        }
    }, [user]);

    // Pripojenie na realtime kanál
    useEffect(() => {
        if (selectedConversation) {
            subscribeToConversation();
            return () => {
                if (channelRef.current) {
                    channelRef.current.unsubscribe();
                }
            };
        }
    }, [selectedConversation]);

    // Scroll na koniec správ
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchConversations = async () => {
        if (!user) return;
        
        try {
            const { data, error } = await supabase
                .rpc('get_user_conversations', {
                    p_user_id: user.id
                });

            if (error) throw error;

            const formattedConversations = data.map((conv: any) => {
                // Pre priame konverzácie nájdeme druhého účastníka
                let otherParticipant = null;
                if (conv.type === 'direct') {
                    otherParticipant = conv.participants.find((p: any) => p.id !== user.id);
                }

                return {
                    id: conv.id,
                    // Pre priame konverzácie použijeme meno druhého účastníka, pre skupiny názov skupiny
                    name: conv.type === 'direct' && otherParticipant ? otherParticipant.name : conv.name,
                    type: conv.type,
                    last_message_at: conv.last_message_time,
                    last_message_text: conv.last_message,
                    last_message_sender_id: null,
                    participants: conv.participants.map((p: any) => ({
                        user_id: p.id,
                        user_name: p.name,
                        role: p.role
                    })),
                    unread_count: conv.unread_count
                };
            });

            setConversations(formattedConversations);
        } catch (error) {
            console.error('Chyba pri načítaní konverzácií:', error);
            toast({
                title: 'Chyba',
                description: 'Nepodarilo sa načítať konverzácie',
                status: 'error',
                duration: 3000,
                isClosable: true
            });
        }
    };

    const fetchAvailableUsers = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, email, name, login')
                .neq('id', user?.id);

            if (error) throw error;
            
            // Upravíme dáta aby obsahovali celé meno
            const formattedUsers = data.map(profile => ({
                id: profile.id,
                email: profile.email,
                name: profile.name && profile.login 
                    ? `${profile.login} ${profile.name}`
                    : profile.name || profile.login || profile.email,
                login: profile.login,
                fullName: profile.name && profile.login 
                    ? `${profile.login} ${profile.name}`
                    : profile.name || profile.login || profile.email
            }));
            
            setAvailableUsers(formattedUsers);
        } catch (error) {
            console.error('Chyba pri načítaní používateľov:', error);
        }
    };

    const fetchMessages = async (conversationId: string) => {
        try {
            const { data, error } = await supabase
                .from('messages')
                .select(`
                    *,
                    reply_to:reply_to_id(
                        content,
                        user_name
                    )
                `)
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setMessages(data);
        } catch (error) {
            console.error('Chyba pri načítaní správ:', error);
            toast({
                title: 'Chyba',
                description: 'Nepodarilo sa načítať správy',
                status: 'error',
                duration: 3000,
            });
        }
    };

    const subscribeToConversation = () => {
        if (!selectedConversation) return;

        // Odpojení od predchádzajúceho kanálu
        if (channelRef.current) {
            channelRef.current.unsubscribe();
        }

        // Pripojenie na nový kanál
        const channel = supabase.channel(`conversation:${selectedConversation.id}`, {
            config: {
                broadcast: { self: true }
            }
        })
        .on('presence', { event: 'sync' }, () => {
            const presenceState = channel.presenceState();
            const typingUsers = new Set<string>();
            
            Object.entries(presenceState).forEach(([_, presences]: [string, any[]]) => {
                presences.forEach(presence => {
                    if (presence.typing) {
                        typingUsers.add(presence.user_id);
                    }
                });
            });
            
            setTypingUsers(typingUsers);
        })
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
            if (payload.user_id !== user?.id) {
                if (payload.typing) {
                    setTypingUsers(prev => new Set([...prev, payload.user_id]));
                } else {
                    setTypingUsers(prev => {
                        const next = new Set(prev);
                        next.delete(payload.user_id);
                        return next;
                    });
                }
            }
        })
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${selectedConversation.id}`
        }, (payload) => {
            const newMessage = payload.new as Message;
            setMessages(prev => [...prev, newMessage]);
            fetchConversations(); // Aktualizácia zoznamu konverzácií
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await channel.track({ user_id: user?.id, typing: false });
                fetchMessages(selectedConversation.id);
            }
        });

        channelRef.current = channel;
    };

    const handleTyping = () => {
        if (!channelRef.current || !selectedConversation) return;

        channelRef.current.track({ user_id: user?.id, typing: true });

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
            channelRef.current?.track({ user_id: user?.id, typing: false });
        }, 3000);
    };

    // const handleSendMessage = async () => {
    //     if (!selectedConversation || !newMessage.trim() || !user) return;

    //     try {
    //         // Najprv získame user_name z profiles tabuľky
    //         const { data: profileData, error: profileError } = await supabase
    //             .from('profiles')
    //             .select('name, login, email')
    //             .eq('id', user.id)
    //             .single();

    //         if (profileError) throw profileError;

    //         // Zostavíme celé meno z name a login
    //         const user_name = profileData.name && profileData.login 
    //             ? `${profileData.name} ${profileData.login}`
    //             : profileData.name || profileData.login || profileData.email;

    //         // Teraz vytvoríme správu s user_name
    //         const { data: messageData, error } = await supabase
    //             .from('messages')
    //             .insert({
    //                 conversation_id: selectedConversation.id,
    //                 content: newMessage.trim(),
    //                 user_id: user.id,
    //                 user_name: user_name,
    //                 reactions: {}
    //             })
    //             .select()
    //             .single();

    //         if (error) throw error;

    //         // Pridáme správu do stavu
    //         if (messageData) {
    //             setMessages(prev => [...prev, messageData as Message]);
    //         }

    //         setNewMessage('');
    //         if (typingTimeoutRef.current) {
    //             clearTimeout(typingTimeoutRef.current);
    //         }
    //         channelRef.current?.track({ user_id: user.id, typing: false });
    //     } catch (error) {
    //         console.error('Chyba pri odosielaní správy:', error);
    //         toast({
    //             title: 'Chyba',
    //             description: 'Nepodarilo sa odoslať správu',
    //             status: 'error',
    //             duration: 3000,
    //         });
    //     }
    // };

    const handleCreateDirectChat = async (otherUserId: string) => {
        try {
            const { data, error } = await supabase
                .rpc('create_direct_conversation', {
                    p_other_user_id: otherUserId
                });

            if (error) throw error;

            await fetchConversations();
            const newConversation = conversations.find(c => c.id === data);
            if (newConversation) {
                setSelectedConversation(newConversation);
            }
            onNewChatClose();
        } catch (error) {
            console.error('Chyba pri vytváraní konverzácie:', error);
            toast({
                title: 'Chyba',
                description: 'Nepodarilo sa vytvoriť konverzáciu',
                status: 'error',
                duration: 3000,
            });
        }
    };

    const handleCreateGroupChat = async () => {
        if (!newGroupName.trim() || selectedUsers.length === 0) return;

        try {
            const { data, error } = await supabase
                .rpc('create_group_conversation', {
                    p_name: newGroupName.trim(),
                    p_participant_ids: selectedUsers
                });

            if (error) throw error;

            await fetchConversations();
            const newConversation = conversations.find(c => c.id === data);
            if (newConversation) {
                setSelectedConversation(newConversation);
            }
            setNewGroupName('');
            setSelectedUsers([]);
            onGroupChatClose();
        } catch (error) {
            console.error('Chyba pri vytváraní skupiny:', error);
            toast({
                title: 'Chyba',
                description: 'Nepodarilo sa vytvoriť skupinu',
                status: 'error',
                duration: 3000,
            });
        }
    };

    // const getConversationName = (conversation: Conversation) => {
    //     if (conversation.type === 'group') {
    //         return conversation.name;
    //     }
    //     const otherParticipant = conversation.participants.find(p => p.user_id !== user?.id);
    //     return otherParticipant?.user_name || 'Neznámy používateľ';
    // };

    // const getConversationAvatar = (conversation: Conversation): string => {
    //     if (conversation.type === 'group') {
    //         return conversation.name || '';
    //     }
    //     const otherParticipant = conversation.participants.find(p => p.user_id !== user?.id);
    //     // Pre avatar použijeme len prvé písmeno z mena
    //     const name = otherParticipant?.user_name || '';
    //     return name.split(' ')[0] || '';
    // };

    // const handleSelectUser = (userId: string) => {
    //     // Implement the logic to select a user
    // };

    const handleDeleteConversation = async (conversationId: string) => {
        try {
            const { error } = await supabase.rpc('delete_conversation', {
                p_conversation_id: conversationId
            });

            if (error) {
                if (error.message.includes('Nemáte oprávnenie')) {
                    toast({
                        title: 'Chyba',
                        description: 'Nemáte oprávnenie na vymazanie tejto konverzácie',
                        status: 'error',
                        duration: 5000,
                        isClosable: true,
                    });
                } else {
                    throw error;
                }
                return;
            }

            // Aktualizujeme zoznam konverzácií
            setConversations(prev => prev.filter(c => c.id !== conversationId));
            
            // Ak bola vymazaná aktuálna konverzácia, vyčistíme ju
            if (selectedConversation?.id === conversationId) {
                setSelectedConversation(null);
                setMessages([]);
            }

            toast({
                title: 'Úspech',
                description: 'Konverzácia bola úspešne vymazaná',
                status: 'success',
                duration: 3000,
                isClosable: true,
            });
        } catch (error) {
            console.error('Chyba pri mazaní konverzácie:', error);
            toast({
                title: 'Chyba',
                description: 'Nepodarilo sa vymazať konverzáciu',
                status: 'error',
                duration: 5000,
                isClosable: true,
            });
        }
    };

    const getInitials = (name: string) => {
        if (!name) return '?';
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name[0].toUpperCase();
    };

    const handleToggleParticipant = (userId: string) => {
        if (selectedUserIds.includes(userId)) {
            setSelectedUserIds(prev => prev.filter(id => id !== userId));
        } else {
            setSelectedUserIds(prev => [...prev, userId]);
        }
    };

    const handleSelectUser = (userId: string) => {
        // Implement the logic to select a user
    };

    const handleAddParticipants = () => {
        // Implement the logic to add selected participants
    };

    const handleCreateGroup = () => {
        // Implement the logic to create a group
    };

    // Funkcia na výber súboru
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            // Kontrola veľkosti súboru (max 10MB)
            if (file.size > 10 * 1024 * 1024) {
                toast({
                    title: 'Chyba',
                    description: 'Súbor je príliš veľký. Maximálna veľkosť je 10MB.',
                    status: 'error',
                    duration: 3000,
                    isClosable: true
                });
                return;
            }
            setSelectedFile(file);
        }
    };

    // Funkcia na nahrávanie súboru
    const uploadFile = async (file: File): Promise<string> => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${user?.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('chat-attachments')
            .upload(filePath, file);

        if (uploadError) {
            throw uploadError;
        }

        const { data } = supabase.storage
            .from('chat-attachments')
            .getPublicUrl(filePath);

        return data.publicUrl;
    };

    // Funkcia na odoslanie správy s prílohou
    const handleSendMessageWithAttachment = async () => {
        if (!selectedConversation || (!newMessage.trim() && !selectedFile) || !user) return;

        try {
            setUploadingFile(true);

            // Najprv získame user_name z profiles tabuľky
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('name, login, email')
                .eq('id', user.id)
                .single();

            if (profileError) throw profileError;

            const user_name = profileData.name && profileData.login 
                ? `${profileData.name} ${profileData.login}`
                : profileData.name || profileData.login || profileData.email;

            let attachmentUrl = null;
            let attachmentName = null;
            let attachmentType = null;

            // Ak je vybraný súbor, nahrajeme ho
            if (selectedFile) {
                attachmentUrl = await uploadFile(selectedFile);
                attachmentName = selectedFile.name;
                attachmentType = selectedFile.type;
            }

            // Vytvoríme správu
            const { data: messageData, error } = await supabase
                .from('messages')
                .insert({
                    conversation_id: selectedConversation.id,
                    content: newMessage.trim(),
                    user_id: user.id,
                    user_name: user_name,
                    reactions: {},
                    attachment_url: attachmentUrl,
                    attachment_name: attachmentName,
                    attachment_type: attachmentType
                })
                .select()
                .single();

            if (error) throw error;

            if (messageData) {
                setMessages(prev => [...prev, messageData as Message]);
            }

            setNewMessage('');
            setSelectedFile(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } catch (error) {
            console.error('Chyba pri odosielaní správy s prílohou:', error);
            toast({
                title: 'Chyba',
                description: 'Nepodarilo sa odoslať správu s prílohou',
                status: 'error',
                duration: 3000,
            });
        } finally {
            setUploadingFile(false);
        }
    };

    // Funkcia na zobrazenie súboru
    const handleDownloadFile = (url: string, fileName: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Funkcia na určenie CSS triedy podľa veľkosti obrázka
    const getImageSizeClass = (width: number, height: number): string => {
        const ratio = width / height;
        
        if (ratio > 2) {
            return 'panorama';
        } else if (ratio < 0.5) {
            return 'panorama';
        } else if (Math.abs(ratio - 1) < 0.1) {
            return 'square';
        } else if (width < 200 || height < 200) {
            return 'small';
        } else if (width > 400 || height > 400) {
            return 'large';
        }
        
        return '';
    };

    // Funkcia na označenie správ ako prečítané
    const markMessagesAsRead = async (conversationId: string) => {
        if (!user) return;
        
        try {
            const { error } = await supabase
                .rpc('mark_messages_as_read', {
                    p_conversation_id: conversationId,
                    p_user_id: user.id
                });

            if (error) throw error;

            // Aktualizujeme zoznam konverzácií aby sa aktualizoval počet neprečítaných správ
            await fetchConversations();
        } catch (error) {
            console.error('Chyba pri označovaní správ ako prečítané:', error);
        }
    };

    // Funkcia na výber konverzácie
    const handleSelectConversation = async (conversation: Conversation) => {
        setSelectedConversation(conversation);
        
        // Označíme správy ako prečítané
        await markMessagesAsRead(conversation.id);
    };

    return (
        <div className="chat-container">
            {/* Sidebar */}
            <div className="chat-sidebar">
                <div className="chat-sidebar-header">
                    <h2 className="chat-sidebar-title">Správy</h2>
                    <div className="chat-sidebar-buttons">
                        <button
                            className="chat-button"
                            onClick={onGroupChatOpen}
                            title="Nová skupina"
                        >
                            <FiUsers />
                        </button>
                        <button
                            className="chat-button"
                            onClick={onNewChatOpen}
                            title="Nová konverzácia"
                        >
                            <FiPlus />
                        </button>
                    </div>
                </div>

                <div className="conversations-list">
                    {conversations.map((conversation) => (
                        <div
                            key={conversation.id}
                            className={`conversation-item ${selectedConversation?.id === conversation.id ? 'active' : ''}`}
                            onClick={() => handleSelectConversation(conversation)}
                        >
                            <div className="conversation-avatar">
                                {conversation.type === 'group' ? (
                                    <div className="avatar group-avatar">
                                        {getInitials(conversation.name || 'Skupina')}
                                    </div>
                                ) : (
                                    <div className="avatar user-avatar">
                                        {getInitials(conversation.participants.find(p => p.user_id !== user?.id)?.user_name || '?')}
                                    </div>
                                )}
                            </div>
                            <div className="conversation-info">
                                <div className="conversation-header">
                                    <span className="conversation-name">
                                        {conversation.type === 'direct' 
                                            ? conversation.participants.find(p => p.user_id !== user?.id)?.user_name 
                                            : conversation.name}
                                    </span>
                                    {conversation.last_message_at && (
                                        <span className="conversation-time">
                                            {formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true, locale: sk })}
                                        </span>
                                    )}
                                </div>
                                <div className="conversation-preview">
                                    {conversation.last_message_text || 'Žiadne správy'}
                                </div>
                            </div>
                            {conversation.unread_count > 0 && (
                                <div className="unread-badge">
                                    {conversation.unread_count}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Hlavný obsah */}
            <div className="chat-main">
                {selectedConversation ? (
                    <>
                        <div className="chat-header">
                            <div className="chat-header-info">
                                <div className="chat-avatar">
                                    {selectedConversation.type === 'group' ? (
                                        <div className="avatar group-avatar">
                                            {getInitials(selectedConversation.name || 'Skupina')}
                                        </div>
                                    ) : (
                                        <div className="avatar user-avatar">
                                            {getInitials(selectedConversation.participants.find(p => p.user_id !== user?.id)?.user_name || '?')}
                                        </div>
                                    )}
                                </div>
                                <div className="chat-header-text">
                                    <div className="chat-title">
                                        {selectedConversation.type === 'direct' 
                                            ? selectedConversation.participants.find(p => p.user_id !== user?.id)?.user_name 
                                            : selectedConversation.name}
                                    </div>
                                    {selectedConversation.type === 'group' && (
                                        <Popover trigger="hover" placement="bottom-start">
                                            <PopoverTrigger>
                                                <div className="chat-subtitle">
                                                    {selectedConversation.participants.length} účastníkov
                                                </div>
                                            </PopoverTrigger>
                                            <PopoverContent width="250px">
                                                <PopoverBody>
                                                    <List spacing={2}>
                                                        {selectedConversation.participants.map((participant) => (
                                                            <ListItem key={participant.user_id} className="participant-item">
                                                                <HStack spacing={2}>
                                                                    <div className="avatar user-avatar small">
                                                                        {getInitials(participant.user_name)}
                                                                    </div>
                                                                    <Text>{participant.user_name}</Text>
                                                                    {participant.role === 'admin' && (
                                                                        <Text fontSize="xs" color="gray.500">(admin)</Text>
                                                                    )}
                                                                </HStack>
                                                            </ListItem>
                                                        ))}
                                                    </List>
                                                </PopoverBody>
                                            </PopoverContent>
                                        </Popover>
                                    )}
                                </div>
                            </div>
                            <div className="chat-actions">
                                <button
                                    className="chat-action-button"
                                    onClick={() => setShowChatMenu(!showChatMenu)}
                                    title="Možnosti"
                                >
                                    <FiMoreVertical />
                                </button>
                                {showChatMenu && (
                                    <div className="chat-menu">
                                        {selectedConversation.type === 'group' && (
                                            <button
                                                className="chat-menu-item"
                                                onClick={() => {
                                                    setShowAddParticipantsModal(true);
                                                    setShowChatMenu(false);
                                                }}
                                            >
                                                <FiUsers className="menu-icon" />
                                                Pridať účastníkov
                                            </button>
                                        )}
                                        {selectedConversation.type === 'group' && (
                                            <button
                                                className="chat-menu-item"
                                                onClick={() => {
                                                    // TODO: Implementovať úpravu názvu skupiny
                                                    setShowChatMenu(false);
                                                }}
                                            >
                                                <FiEdit2 className="menu-icon" />
                                                Upraviť názov skupiny
                                            </button>
                                        )}
                                        <button
                                            className="chat-menu-item"
                                            onClick={() => {
                                                // TODO: Implementovať zobrazenie informácií o konverzácii
                                                setShowChatMenu(false);
                                            }}
                                        >
                                            <FiUsers className="menu-icon" />
                                            Informácie o konverzácii
                                        </button>
                                        {selectedConversation.type === 'group' && (
                                            <button
                                                className="chat-menu-item"
                                                onClick={() => {
                                                    handleDeleteConversation(selectedConversation.id);
                                                    setShowChatMenu(false);
                                                }}
                                            >
                                                <FiTrash2 className="menu-icon" />
                                                Vymazať konverzáciu
                                            </button>
                                        )}
                                        {selectedConversation.type === 'direct' && (
                                            <button
                                                className="chat-menu-item"
                                                onClick={() => {
                                                    handleDeleteConversation(selectedConversation.id);
                                                    setShowChatMenu(false);
                                                }}
                                            >
                                                <FiTrash2 className="menu-icon" />
                                                Vymazať konverzáciu
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="chat-messages">
                            {messages.map(message => (
                                <div
                                    key={message.id}
                                    className={`chat-message ${message.user_id === user?.id ? 'sent' : 'received'}`}
                                >
                                    {message.reply_to && (
                                        <div className="chat-message-reply">
                                            <div className="chat-message-reply-author">
                                                {message.reply_to.user_name}
                                            </div>
                                            <div className="chat-message-reply-content">
                                                {message.reply_to.content}
                                            </div>
                                        </div>
                                    )}
                                    {message.content && (
                                        <div className="chat-message-content">
                                            {message.content}
                                        </div>
                                    )}
                                    
                                    {/* Zobrazenie prílohy */}
                                    {message.attachment_url && (
                                        <div className="chat-message-attachment">
                                            {message.attachment_type?.startsWith('image/') ? (
                                                <div className="attachment-image">
                                                    <img 
                                                        src={message.attachment_url} 
                                                        alt={message.attachment_name || 'Obrázok'}
                                                        onClick={() => {
                                                            if (message.attachment_url) {
                                                                setImageModal({
                                                                    isOpen: true,
                                                                    imageUrl: message.attachment_url,
                                                                    imageName: message.attachment_name || 'Obrázok'
                                                                });
                                                            }
                                                        }}
                                                        onLoad={(e) => {
                                                            const img = e.target as HTMLImageElement;
                                                            const sizeClass = getImageSizeClass(img.naturalWidth, img.naturalHeight);
                                                            if (sizeClass) {
                                                                img.parentElement?.classList.add(sizeClass);
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            ) : (
                                                <div className="attachment-file">
                                                    <div className="attachment-file-info">
                                                        <span className="attachment-file-name">
                                                            {message.attachment_name}
                                                        </span>
                                                        <button
                                                            className="attachment-download-button"
                                                            onClick={() => handleDownloadFile(message.attachment_url!, message.attachment_name!)}
                                                            title="Stiahnuť súbor"
                                                        >
                                                            <FiDownload />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    
                                    <div className="chat-message-time">
                                        {format(new Date(message.created_at), 'HH:mm', { locale: sk })}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {typingUsers.size > 0 && (
                            <div className="chat-typing-indicator">
                                {Array.from(typingUsers).map(id => {
                                    const participant = selectedConversation.participants.find(p => p.user_id === id);
                                    return participant?.user_name;
                                }).filter(Boolean).join(', ')} píše...
                            </div>
                        )}

                        <div className="chat-input-container">
                            {/* Zobrazenie vybraného súboru */}
                            {selectedFile && (
                                <div className="selected-file">
                                    <span className="selected-file-name">{selectedFile.name}</span>
                                    <button
                                        className="remove-file-button"
                                        onClick={() => {
                                            setSelectedFile(null);
                                            if (fileInputRef.current) {
                                                fileInputRef.current.value = '';
                                            }
                                        }}
                                        title="Odobrať súbor"
                                    >
                                        <FiX />
                                    </button>
                                </div>
                            )}
                            
                            <div className="chat-input-wrapper">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    onChange={handleFileSelect}
                                    style={{ display: 'none' }}
                                    accept="image/*,.pdf,.doc,.docx,.txt,.zip,.rar"
                                />
                                <button
                                    className="chat-attachment-button"
                                    onClick={() => fileInputRef.current?.click()}
                                    title="Pridať prílohu"
                                >
                                    <FiPaperclip />
                                </button>
                                <textarea
                                    className="chat-input"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendMessageWithAttachment();
                                        }
                                    }}
                                    onKeyDown={handleTyping}
                                    placeholder="Napíšte správu..."
                                    rows={1}
                                />
                                <button
                                    className="chat-send-button"
                                    onClick={handleSendMessageWithAttachment}
                                    disabled={(!newMessage.trim() && !selectedFile) || uploadingFile}
                                    title="Odoslať správu"
                                >
                                    {uploadingFile ? '...' : <FiSend />}
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="chat-empty-state">
                        <div className="chat-empty-state-icon">💬</div>
                        <div className="chat-empty-state-text">
                            Vyberte konverzáciu alebo vytvorte novú
                        </div>
                    </div>
                )}
            </div>

            {/* Modal pre novú konverzáciu */}
            {isNewChatOpen && (
                <div className="chat-modal-overlay">
                    <div className="chat-modal">
                        <div className="chat-modal-header">
                            <h3 className="chat-modal-title">Nová konverzácia</h3>
                            <button
                                className="chat-modal-close"
                                onClick={onNewChatClose}
                                title="Zavrieť"
                            >
                                <FiX />
                            </button>
                        </div>
                        <div className="chat-modal-body">
                            <div className="chat-user-list">
                                {availableUsers.map(participant => (
                                    <div
                                        key={participant.id}
                                        className="chat-user-item"
                                        onClick={() => handleCreateDirectChat(participant.id)}
                                    >
                                        <div className="chat-avatar">
                                            {participant.fullName.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="chat-user-info">
                                            <div className="chat-user-name">
                                                {participant.fullName}
                                            </div>
                                            {participant.email && (
                                                <div className="chat-user-email">
                                                    {participant.email}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal pre novú skupinu */}
            {isGroupChatOpen && (
                <div className="chat-modal-overlay">
                    <div className="chat-modal">
                        <div className="chat-modal-header">
                            <h3 className="chat-modal-title">Nová skupina</h3>
                            <button
                                className="chat-modal-close"
                                onClick={onGroupChatClose}
                                title="Zavrieť"
                            >
                                <FiX />
                            </button>
                        </div>
                        <div className="chat-modal-body">
                            <div className="group-chat-form">
                                <div className="form-group">
                                    <label className="form-label">Názov skupiny</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={newGroupName}
                                        onChange={(e) => setNewGroupName(e.target.value)}
                                        placeholder="Zadajte názov skupiny"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Vyberte účastníkov</label>
                                    <div className="participant-list">
                                        {availableUsers.map(participant => (
                                            <div
                                                key={participant.id}
                                                className={`participant-item ${selectedUsers.includes(participant.id) ? 'selected' : ''}`}
                                                onClick={() => {
                                                    setSelectedUsers(prev =>
                                                        prev.includes(participant.id)
                                                            ? prev.filter(id => id !== participant.id)
                                                            : [...prev, participant.id]
                                                    );
                                                }}
                                            >
                                                <div 
                                                    className={`participant-checkbox ${selectedUsers.includes(participant.id) ? 'checked' : ''}`}
                                                >
                                                    <div className="check-icon">✓</div>
                                                </div>
                                                <div className="chat-avatar">
                                                    {getInitials(participant.fullName)}
                                                </div>
                                                <div className="participant-info">
                                                    <div className="participant-name">{participant.fullName}</div>
                                                    <div className="participant-email">{participant.email}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="modal-actions">
                            <button
                                className="modal-button modal-button-secondary"
                                onClick={onGroupChatClose}
                            >
                                Zrušiť
                            </button>
                            <button
                                className="modal-button modal-button-primary"
                                onClick={handleCreateGroupChat}
                                disabled={!newGroupName.trim() || selectedUsers.length === 0}
                            >
                                Vytvoriť skupinu
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal pre pridanie účastníkov */}
            <Modal isOpen={showAddParticipantsModal} onClose={() => setShowAddParticipantsModal(false)}>
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>Pridať účastníkov</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        <VStack spacing={4} align="stretch">
                            {availableUsers.map((user) => (
                                <HStack
                                    key={user.id}
                                    p={2}
                                    borderRadius="md"
                                    _hover={{ bg: 'gray.100' }}
                                    cursor="pointer"
                                    onClick={() => handleToggleParticipant(user.id)}
                                >
                                    <div className="avatar user-avatar">
                                        {getInitials(user.fullName)}
                                    </div>
                                    <Text>{user.fullName}</Text>
                                    {selectedUserIds.includes(user.id) && (
                                        <Icon as={FaCheck} color="green.500" ml="auto" />
                                    )}
                                </HStack>
                            ))}
                        </VStack>
                    </ModalBody>
                    <ModalFooter>
                        <Button colorScheme="blue" mr={3} onClick={handleAddParticipants}>
                            Pridať
                        </Button>
                        <Button variant="ghost" onClick={() => setShowAddParticipantsModal(false)}>
                            Zrušiť
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Modal pre vytvorenie novej konverzácie */}
            <Modal isOpen={showNewConversationModal} onClose={() => setShowNewConversationModal(false)}>
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>
                        {isGroupChat ? 'Nová skupinová konverzácia' : 'Nová konverzácia'}
                    </ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        <VStack spacing={4}>
                            <HStack width="100%">
                                <Button
                                    flex={1}
                                    variant={!isGroupChat ? 'solid' : 'outline'}
                                    onClick={() => setIsGroupChat(false)}
                                >
                                    Priama správa
                                </Button>
                                <Button
                                    flex={1}
                                    variant={isGroupChat ? 'solid' : 'outline'}
                                    onClick={() => setIsGroupChat(true)}
                                >
                                    Skupina
                                </Button>
                            </HStack>

                            {isGroupChat && (
                                <FormControl>
                                    <FormLabel>Názov skupiny</FormLabel>
                                    <Input
                                        value={groupName}
                                        onChange={(e) => setGroupName(e.target.value)}
                                        placeholder="Zadajte názov skupiny"
                                    />
                                </FormControl>
                            )}

                            <Box width="100%">
                                <Text mb={2}>Vyberte používateľa{isGroupChat ? 'ov' : ''}:</Text>
                                <VStack spacing={2} align="stretch" maxH="300px" overflowY="auto">
                                    {availableUsers.map((user) => (
                                        <HStack
                                            key={user.id}
                                            p={2}
                                            borderRadius="md"
                                            _hover={{ bg: 'gray.100' }}
                                            cursor="pointer"
                                            onClick={() => isGroupChat 
                                                ? handleToggleParticipant(user.id)
                                                : handleSelectUser(user.id)
                                            }
                                        >
                                            <div className="avatar user-avatar">
                                                {getInitials(user.fullName)}
                                            </div>
                                            <Text>{user.fullName}</Text>
                                            {isGroupChat && selectedUserIds.includes(user.id) && (
                                                <Icon as={FaCheck} color="green.500" ml="auto" />
                                            )}
                                        </HStack>
                                    ))}
                                </VStack>
                            </Box>
                        </VStack>
                    </ModalBody>
                    <ModalFooter>
                        {isGroupChat ? (
                            <>
                                <Button
                                    colorScheme="blue"
                                    mr={3}
                                    onClick={handleCreateGroup}
                                    isDisabled={!groupName || selectedUserIds.length === 0}
                                >
                                    Vytvoriť skupinu
                                </Button>
                                <Button variant="ghost" onClick={() => setShowNewConversationModal(false)}>
                                    Zrušiť
                                </Button>
                            </>
                        ) : (
                            <Button variant="ghost" onClick={() => setShowNewConversationModal(false)}>
                                Zavrieť
                            </Button>
                        )}
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Modal pre zobrazenie obrázka */}
            {imageModal.isOpen && (
                <div 
                    className="image-modal-overlay"
                    onClick={() => setImageModal({ isOpen: false, imageUrl: '', imageName: '' })}
                >
                    <div 
                        className="image-modal"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="image-modal-header">
                            <h3 className="image-modal-title">{imageModal.imageName}</h3>
                            <button
                                className="image-modal-close"
                                onClick={() => setImageModal({ isOpen: false, imageUrl: '', imageName: '' })}
                                title="Zavrieť"
                            >
                                <FiX />
                            </button>
                        </div>
                        <div className="image-modal-body">
                            <img
                                src={imageModal.imageUrl}
                                alt={imageModal.imageName}
                                style={{ maxWidth: '100%', maxHeight: '80vh' }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}; 