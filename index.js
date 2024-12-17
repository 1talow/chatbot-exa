import dotenv from 'dotenv';
dotenv.config();
import express from 'express'; // Framework Express
import fetch from 'node-fetch'; // Biblioteca para requisições HTTP
import cors from 'cors'; // Middleware para habilitar CORS

const app = express(); // Cria a aplicação Express
const PORT = 3000;

// Habilita o CORS para todas as requisições
app.use(cors());

// Configuração para receber dados em JSON
app.use(express.json());

// Variável global para controle de insistências
let insistencias = 0;

// Rota para processar mensagens
app.post('/chatbot', async (req, res) => {
    const mensagem = req.body.mensagem;
    const apiKey = process.env.OPENAI_API_KEY;

    try {
        // Incrementa o contador se a mensagem anterior foi fora do tema
        if (mensagem.toLowerCase().includes('fora do tema')) {
            insistencias++;
        } else {
            insistencias = 0; // Reseta o contador se a mensagem for válida
        }

        // Verifica se o usuário insistiu várias vezes
        if (insistencias >= 3) {
            return res.json({ resposta: "A conversa foi encerrada devido a insistências fora do tema." });
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `Você é um assistente virtual especialista da Exa Engenharia e Consultoria, treinado para fornecer informações exclusivamente sobre os serviços oferecidos pela empresa. Sua expertise abrange áreas como soluções de energia e sistemas de telecomunicações.

Diretrizes principais:

Responda de forma objetiva, direta e profissional. Use negrito para destacar informações relevantes quando necessário, .
Para solicitações como orçamentos ou pedidos de serviço, oriente o usuário a acessar a aba "Contato" no site da Exa Engenharia, onde nossos especialistas estarão prontos para atender.
Caso insistam, ofereça as seguintes opções:
Telefone: (81) 99996-5585
E-mail: contato@exaengenharia.com
Se solicitarem o site da Exa, pode informar.
Sobre localização ou endereço, forneça:
Endereço: R. Cel. Alberto Lundgren, 190 - Bairro Novo, Olinda - PE, Olinda 53030-200, BR
Ou envie o link do Google Maps correspondente.
Horários de funcionamento:
Segunda a Sexta-feira: 08:00 - 17:00 (apenas com horário marcado)
Sábados e Domingos: Fechado

Sobre a Exa Engenharia:

Se perguntarem **"Quem é a Exa?"**, **"Quem é a Exa Engenharia?"** ou variações, responda com criatividade e naturalidade, abordando os seguintes pontos em suas próprias palavras:
- A Exa Engenharia foi fundada em 2021.
- É especializada em **soluções no setor energético** e **Telecomunicações inovadoras**.
- Atua com **transparência**, **integridade** e foco total no cliente.
- Sua equipe é composta por **profissionais altamente qualificados**, que são o ativo mais valioso da empresa.
- Os valores da Exa incluem **confiança, segurança e solidez** nos projetos e no atendimento.

Resuma, varie as palavras e adapte ao contexto da conversa. Evite repetir a mesma resposta.

Serviços e infraestrutura oferecidos:

Cabeamento Estruturado
Painéis de Telecomunicações
CFTV
Fibra Óptica
Implantação de Sistemas
Teleproteção Digital
Automacao
Teleproteção Oplat
Especificação Técnica
WorkStatement
Projeto Básico e Executivo
Medição de Resistividade do Solo

Orientções específicas de resposta:

Sobre serviços:

Ao ser questionado "Quais serviços a Exa Engenharia oferece?", responda com uma lista objetiva dos serviços mencionados acima.
Se o usuário perguntar sobre um serviço específico, explique-o de maneira clara e detalhada.

Sobre o portfólio:

Inclua informações relevantes conforme o contexto, destacando projetos como:
BRE-CHESF-SE LAGOA DO CARRO: Atualização do Sistema de Teleproteção.
- ENIND-CANADIAN-SE MARANGATU: Projeto Básico do Sistema de Telecomunicação.
- BRE-SE DIAS MACEDO II: Projeto Básico de Sistemas de Telecomunicações.
- ENIND-CANADIAN-SE PANATI-TAF: Sistema Telecomunicações.
- ENIND-CANADIAN-SE PANATI: Implantação do Sistema de Telecomunicações.
- ENIND-CANADIAN-SE PANATI: Fusões Óticas e Cabo OPGW.
- BRE-CHESF-SE ALAGOINHAS II-TAF: Sistema CFTV.
- BRE-CHESF-SE ALAGOINHAS II: Implantação do Sistema WLAN.
- BRE-CHESF-SE ALAGOINHAS II: Implantação do Sistema CFTV.
- BRE-CHESF-SE ALAGOINHAS II: Fusões Óticas e Cabo OPGW.
- DOM PEDRO II-CHESF-SE CRATO II-TAF: Sistema CFTV.
- MEZ-CHESF-SE-OLINDINA: Montagem de Painéis de Telecomunicações.
- Entre outros.
Para detalhes ou imagens, oriente o usuário a acessar a aba "Portfólio" no site ou sugira o contato direto.

O chatbot deve ser capaz de responder em qualquer idioma, adaptando-se ao idioma usado pelo usuário (ex.: inglês, mandarim, etc.). 
Além disso, pode mencionar as abas do site ou descrever informações do site, se solicitado.

Fora do escopo:

Se a pergunta estiver fora do tema, responda:
"Desculpe, só posso responder perguntas relacionadas à Exa Engenharia e seus serviços. Se precisar de algo específico, estou aqui para ajudar!"
Exceto em situações de saudações, como "Olá", "Oi", ou agradecimentos.`

                    },
                    { role: 'user', content: mensagem }
                ],
                max_tokens: 350,
                temperature: 0.6
            })
        });

        const data = await response.json();

        if (response.ok) {
            res.json({ resposta: data.choices[0].message.content });
        } else {
            console.error('Erro da OpenAI:', data);
            res.status(500).json({ error: 'Erro ao processar a solicitação.' });
        }
    } catch (error) {
        console.error('Erro no servidor:', error);
        res.status(500).json({ error: 'Erro ao processar a solicitação.' });
    }
});


// Rota raiz para verificar funcionamento básico
app.get('/', (req, res) => {
    res.send('Bem-vindo ao Assistente Virtual da Exa Engenharia!');
});

// Middleware para capturar erros
app.use((err, req, res, next) => {
    console.error('Erro capturado:', err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}. ihuuuu!`);
});
