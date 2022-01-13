import React, { ChangeEventHandler, MouseEventHandler } from 'react';
import { ChakraProvider, Box } from '@chakra-ui/react';

import Connect from './Live/Connect';
import Participants from './Live/Participants';

import AppStore from '../../stores/AppStore';
import { saveSchedule, loadSchedule } from '../../actions/AppStoreActions';

class LoadSaveScheduleFunctionality extends React.Component {
    pathnames = window.location.pathname.split('/');
    schedule = this.pathnames.pop() || this.pathnames.pop();
    websocket?: WebSocket;

    state = { submitted: false, ready: false, name: '', users: [] };
    onChange: ChangeEventHandler = (event) => {
        const target = event.target as HTMLInputElement;
        const name = target.name;

        this.setState({
            [name]: target.value,
        });
    };
    onSubmit: MouseEventHandler = (event) => {
        event.preventDefault();
        this.setState({
            submitted: true,
        });
        if (!this.websocket) {
            this.websocket = new WebSocket(`wss://cymric.cats.alexanderliu.com/api/room/${this.schedule}/websocket`);
            this.websocket!.addEventListener('open', () => {
                this.websocket!.send(
                    JSON.stringify({
                        name: this.state.name,
                    })
                );
            });
            this.websocket.addEventListener('message', (event) => {
                const data = JSON.parse(event.data);
                if (!this.state.ready && data.ready == true) this.setState({ ready: true });
                if (data.joined) {
                    this.setState((state: typeof this.state) => ({
                        users: [...state.users, data.joined],
                    }));
                }
                if (data.quit) {
                    this.setState((state: typeof this.state) => {
                        const users = state.users;
                        // @ts-ignore
                        const index = users.indexOf(data.quit);
                        if (index > -1) {
                            return { users: users.splice(index, 1) };
                        }
                    });
                }
                if (data.schedule) {
                    loadSchedule(this.websocket, data.schedule);
                }
            });
        }
    };

    appStoreEventListener = () => {
        saveSchedule(this.websocket, this.schedule);
    };

    componentDidMount() {
        AppStore.addEventListener(this.appStoreEventListener);
    }

    componentWillUnmount() {
        AppStore.removeEventListener(this.appStoreEventListener);
        this.websocket?.close();
    }

    render() {
        return (
            <ChakraProvider>
                <Box mr="4">
                    {this.state.ready ? (
                        <Participants users={this.state.users} />
                    ) : (
                        <Connect
                            submitted={this.state.submitted}
                            value={this.state.name}
                            onChange={this.onChange}
                            onSubmit={this.onSubmit}
                        />
                    )}
                </Box>
            </ChakraProvider>
        );
    }
}

export default LoadSaveScheduleFunctionality;
