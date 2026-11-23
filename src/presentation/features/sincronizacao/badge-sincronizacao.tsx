import { Link } from 'react-router-dom';
export function BadgeSincronizacao({className}: {className?:string}){return <Link className={className} to="/simulador" title="Nenhum servidor ou integração real está conectado">Demonstração</Link>;}
