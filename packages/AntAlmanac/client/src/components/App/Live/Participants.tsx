import React from 'react';
import { AvatarGroup, Tooltip, Avatar } from '@chakra-ui/react';

export declare interface ParticipantsProps {
    users: string[];
}

class Participants extends React.Component<ParticipantsProps> {
    render() {
        return (
            <AvatarGroup size="md" max={4}>
                {this.props.users.map((user) => {
                    return (
                        <Tooltip label={user}>
                            <Avatar name={user} src={`https://avatars.dicebear.com/api/pixel-art/${user}.svg`} />
                        </Tooltip>
                    );
                })}
            </AvatarGroup>
        );
    }
}

export default Participants;
