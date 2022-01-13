import React, { ChangeEventHandler, EventHandler } from 'react';
import { FormControl, Input, IconButton, Box, Spinner } from '@chakra-ui/react';
import { CheckIcon } from '@chakra-ui/icons';

export declare interface NameInputProps {
    submitted: boolean;
    value: string;
    onChange: ChangeEventHandler;
    onSubmit: EventHandler<any>;
}

class Connect extends React.Component<NameInputProps> {
    render() {
        return (
            <form onSubmit={this.props.onSubmit}>
                <FormControl mr="4" display="flex" alignItems="center">
                    <Input
                        mr="2"
                        placeholder="Name"
                        name="name"
                        value={this.props.value}
                        onChange={this.props.onChange}
                    />
                    <IconButton
                        mr="2"
                        onClick={this.props.onSubmit}
                        aria-label="Join"
                        icon={<CheckIcon color="black" />}
                    />
                    <Box>{this.props.submitted ? <Spinner size="md" display="block" /> : <></>}</Box>
                </FormControl>
            </form>
        );
    }
}

export default Connect;
