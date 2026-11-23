import { beforeEach, describe, expect, it } from 'vitest';
import { aceitar, colecoes, confirmar, conversa, criarPedido, dia, iniciarAmostra, propor, solicitacoes } from '../src/demo/estado.js';
describe('Demonstração isolada',()=>{
 beforeEach(()=>{solicitacoes.length=0;conversa.length=0;iniciarAmostra();});
 it('cria exatamente três pacientes fictícios, sem telefone e documentos',()=>{expect(colecoes.pacientes).toHaveLength(3);for(const p of colecoes.pacientes!){expect(p.id).toMatch(/^demo-/);expect(p.cpf).toBeNull();expect(p.celular).toBeNull();}});
 it('cria pedidos sem ocupar a agenda',()=>{const n=colecoes.consultas!.length;criarPedido(dia(2),'10:00','Avaliação');expect(colecoes.consultas).toHaveLength(n);expect(solicitacoes).toHaveLength(1);});
 it('exige aceite e confirmação final',()=>{const s=criarPedido(dia(2),'10:00','Avaliação');propor(s,45);expect(()=>confirmar(s)).toThrow(/aceite/);aceitar(s,true);const n=colecoes.consultas!.length;expect(s.status).toBe('PENDENTE');confirmar(s);expect(colecoes.consultas).toHaveLength(n+1);expect(s.status).toBe('APROVADA');expect(()=>confirmar(s)).toThrow();});
 it('recusa não ocupa horário',()=>{const s=criarPedido(dia(2),'10:00','Avaliação');propor(s,45);aceitar(s,false);expect(()=>confirmar(s)).toThrow();expect(colecoes.consultas).toHaveLength(3);});
 it('respeita o descanso e exige duração',()=>{const s=criarPedido(dia(2),'11:30','Avaliação');expect(()=>propor(s,0)).toThrow();propor(s,90);expect(s.propostaHorario.horario).toBe('13:30');});
 it('revalida conflito após o aceite',()=>{const s=criarPedido(dia(2),'10:00','Avaliação');propor(s,45);aceitar(s,true);colecoes.consultas!.push({id:'outro',data:dia(2),horario:'10:00',duracaoMinutos:45,status:'CONFIRMADA'});expect(()=>confirmar(s)).toThrow(/ocupado/);});
});
