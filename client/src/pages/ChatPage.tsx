import React from 'react';
import { Box } from '@chakra-ui/react';
import { Chat } from '../components/Chat';

export const ChatPage: React.FC = () => {
    return (
        <Box h="100vh">
            <Chat />
        </Box>
    );
}; 