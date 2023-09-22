
addEventListener('message', (message) => {
	    console.log('echo!', message.data);
		postMessage(message.data);
});
