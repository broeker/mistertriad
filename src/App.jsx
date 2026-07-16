import { useState, useEffect } from 'react';
import ProgressionPage from './ProgressionPage.jsx';
import TriadFinder from './TriadFinder.jsx';
import Player from './Player.jsx';

/* ---- Router ---- */
function useHashRoute() {
  const [route,setRoute]=useState(window.location.hash);
  useEffect(()=>{
    const onHash=()=>setRoute(window.location.hash);
    window.addEventListener('hashchange',onHash);
    return ()=>window.removeEventListener('hashchange',onHash);
  },[]);
  return route;
}

export default function App() {
  const route=useHashRoute();
  if (route.startsWith('#/triadfinder')) return <TriadFinder/>;
  if (route.startsWith('#/player')) return <Player/>;
  return <ProgressionPage/>;
}
