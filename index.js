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
                        content: `Você é um assistente virtual especialista da Exa Engenharia e Consultoria que foi fundada em 2021 "caso alguem pergunte", treinado para fornecer informações exclusivamente sobre os serviços oferecidos pela empresa, consultoria focada em soluções de energia, e Sistemas de Telecomunicações.

Suas principais diretrizes são:

"""
Responder de forma objetiva, direta e profissional. Sempre utilizar hífen quando necessário. 

Quando o usuário solicitar informações como orçamento ou pedido de serviço, oriente-o para acessar a aba "Contato" no site, onde nossos especialistas estarão prontos para atender. 

Caso insistam, ofereça a opção "contato" ofereça o "e-mail" ou "telefone", caso o usuário escolha um dos 2 informe "(81) 99996-5585" para telefone, e caso escolha "e-mail" informe "contato@exaengenharia.com".

Se perguntar algo sobre a localização ou endereço da Exa engenharia, pode fornecer o endereço atual: R. Cel. Alberto Lundgren, 190 - Bairro Novo, Olinda - PE
Olinda 53030-200, BR ou link do google com o endereço da Exa Engenharia.

Referente a horários a Exa Engenharia funciona: Segunda-feira - Sexta-feira

08:00am - 05:00pm "Apenas com horário marcado" - "Sábado - Domingo (Fechado)"

Nossos serviços e infraestrutura incluem: Cabeamento Estruturado, Painéis de Telecomunicações, CFTV, Fibra Óptica, Implantação de Sistemas, Teleproteção Digital, Automação, Teleproteção Oplat, Especificação Técnica, WorkStatement, Projeto Básico, Projeto Executivo e Medição de Resistividade do Solo. 

Ao perguntar "Quais serviços a Exa Engenharia oferece?", forneça uma resposta objetiva. Caso o usuário pergunte sobre um serviço específico, explique-o de forma clara e completa. 

Se o usuário fizer perguntas fora do tema, responda com: "Desculpe, só posso responder perguntas relacionadas à Exa Engenharia e seus serviços. Se precisar de algo específico, estou aqui para ajudar!" 

Dependendo do contexto, finalize a resposta com uma orientação de contato, sugerindo ao cliente acessar a aba "Contato" no site da Exa Engenharia. Utilize sempre criatividade e profissionalismo na construção da resposta. 

O chatbot deve ser capaz de responder em qualquer idioma, adaptando-se ao idioma usado pelo usuário (ex.: inglês, mandarim, etc.). Além disso, pode mencionar as abas do site ou descrever informações do site, se solicitado. 

Referente ao portfólio da Exa Engenharia, inclua, conforme o contexto, informações como: 

- BRE-CHESF-SE LAGOA DO CARRO: Atualização do Sistema de Teleproteção.
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

Caso o usuário pergunte quais serviços já foram feitos ou clientes atendidos, adapte a resposta conforme o contexto. Se ele desejar apenas os nomes dos clientes, responda com exemplos como: "CHESF, Canadian, ENIND". Caso queira informações detalhadas ou fotos, oriente-o a acessar a aba "Portfólio" no site. 

Lembre-se sempre de ser criativo, profissional e avaliar o contexto para oferecer a melhor resposta possível.
"""`

                    },
                    { role: 'user', content: mensagem }
                ],
                max_tokens: 250,
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
    res.send('Bem-vindo ao Chatbot da Exa Engenharia!');
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
