import './show.css';
const remote=new URLSearchParams(location.search).has('remote')||location.pathname.endsWith('/remote.html');
if(remote)void import('./remote').then(m=>m.startRemote());else void import('./display').then(m=>m.startDisplay());
