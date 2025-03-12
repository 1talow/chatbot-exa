import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const apiKey = process.env.OPENAI_API_KEY;

// 🔹 Criar variável para armazenar os dados do usuário
let dadosUsuarios = {}; // Armazena temporariamente os dados do usuário

// 🚀 Função para decidir se o chatbot deve gerar perguntas ou apenas responder
function decidirGerarPerguntas(mensagemUsuario) {
    const perguntasSimples = [
        "Quais serviços a EXA oferece?",
        "Qual o telefone da EXA Engenharia?",
        "Qual o e-mail da EXA Engenharia?",
        "Onde fica a EXA Engenharia?",
        "Qual o horário de atendimento da EXA?"
    ];

    return !perguntasSimples.includes(mensagemUsuario);
}

// 🔹 Função para traduzir os serviços para o idioma detectado
async function traduzirServicos(idiomaDetectado) {
    try {
        const servicosEmPortugues = `
        Cabeamento Estruturado, Painéis de Telecomunicações, CFTV, Fibra Óptica, Implantação de Sistemas, 
        Teleproteção Digital, Automação, Teleproteção Oplat, Especificação Técnica, WorkStatement, 
        Projeto Básico e Executivo, Medição de Resistividade do Solo.
        `;

        // 🔹 Requisição para a OpenAI traduzir os serviços
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: `Traduza a seguinte lista de serviços da EXA Engenharia para ${idiomaDetectado}, mantendo a formatação natural e sem explicações:` },
                    { role: 'user', content: servicosEmPortugues }
                ],
                max_tokens: 200,
                temperature: 0
            })
        });

        if (!response.ok) {
            console.error("❌ Erro ao traduzir serviços.");
            return servicosEmPortugues; // Se houver erro, retorna em português
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content.trim() || servicosEmPortugues;

    } catch (error) {
        console.error("❌ Erro ao traduzir serviços:", error);
        return servicosEmPortugues; // Se falhar, assume português
    }
}

// 🔹 Configuração do Nodemailer para envio de e-mails
const transporter = nodemailer.createTransport({
    host: "smtp.titan.email",
    port: 465,
    secure: true, // true para SSL/TLS
    auth: {
        user: process.env.EMAIL_USER, // E-mail de envio
        pass: process.env.EMAIL_PASS, // Senha ou senha de aplicativo
    },
});

// 🔹 Função para enviar e-mail com os dados coletados
async function enviarEmail(dados) {
    try {
        const mailOptions = {
            from: `"EXA Engenharia" <${process.env.EMAIL_USER}>`,
            to: "contato@exaengenharia.com", // E-mail de destino
            subject: "Novo Pedido de Orçamento |Handoff EXAbot| Outbound| Triagem Automatizada| EXA Engenharia",
            html: `
    <h2>📌 <strong>NOVO PEDIDO DE ORÇAMENTO</strong></h2>
    <hr>
    <p><strong>📞 Telefone:</strong> ${dados.telefone || "Não informado"}</p>
    <p><strong>📧 E-mail:</strong> ${dados.email || "Não informado"}</p>
    <p><strong>👤 Nome:</strong> ${dados.nome}</p>
    <p><strong>📝 Resumo da conversa:</strong> ${dados.resumo || "Sem detalhes adicionais"}</p>
    <hr>
    <p>📍 <em>Esta solicitação foi gerada automaticamente pelo ExaBot.</em></p>
`,
        };

        await transporter.sendMail(mailOptions);
        console.log("✅ E-mail enviado com sucesso!");
    } catch (error) {
        console.error("❌ Erro ao enviar o e-mail:", error);
    }
}

// 🔹 Função para gerar um resumo inteligente da conversa usando a OpenAI
async function gerarResumoConversa(historico) {
    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "Resuma a conversa do usuário com o chatbot da EXA Engenharia de forma clara e objetiva. Destaque qual foi o interesse do usuário e sua dúvida principal." },
                    { role: "user", content: historico.join("\n") }
                ],
                max_tokens: 200,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            console.error("❌ Erro ao gerar resumo com a OpenAI.");
            return "Resumo não disponível devido a um erro na API.";
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content.trim() || "Resumo não disponível.";
        
    } catch (error) {
        console.error("❌ Erro ao gerar resumo com a OpenAI:", error);
        return "Resumo não disponível.";
    }
}



        // 🔹 Endpoint principal do chatbot
        app.post('/chatbot', async (req, res) => {
        try {
        const { mensagem } = req.body;

        // 🔹 Criar variável global para armazenar histórico da conversa
if (!dadosUsuarios.historico) {
    dadosUsuarios.historico = [];
}

// 🔹 Armazenar a nova mensagem no histórico
dadosUsuarios.historico.push(mensagem);


        // 🔹 Verifica se o usuário pediu um orçamento
        if (mensagem.toLowerCase().includes("orçamento") || mensagem.toLowerCase().includes("cotação") || mensagem.toLowerCase().includes("contratar")) {
        return res.json({
        resposta: "Para oferecer um atendimento mais eficiente, podemos solicitar seus dados para um especialista entrar em contato com você. Podemos continuar?",
        perguntasDinamicas: ["Sim", "Não"]
        });
}

        // 🔹 Verifica a resposta do usuário para a pergunta sobre solicitar contato
        if (mensagem.toLowerCase() === "sim") {
        return res.json({
        resposta: "Ótimo! Para dar continuidade, poderia me informar seu **telefone com (DDD)** ou **e-mail?**",
        perguntasDinamicas: []
        });
}

        if (mensagem.toLowerCase() === "não") {
        return res.json({
        resposta: "Sem problemas! Caso precise, você pode entrar em contato com a EXA Engenharia pelo 📞**telefone (81) 99996-5585** ou ✉️**e-mail contato@exaengenharia.com**. Obrigado!😀",
        perguntasDinamicas: []
        });
}


// 🔹 Validação dinâmica de telefone: aceita formatos variados com ou sem (), -, espaço
const regexTelefone = /^(\(?\d{2}\)?\s?)?(\d{4,5})[-.\s]?(\d{4})$/;

// 🔹 Validação de e-mail: exige um formato correto
const regexEmail = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// 🔹 Validação do nome: impede números e caracteres inválidos
const regexNome = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?: [A-Za-zÀ-ÖØ-öø-ÿ]+)+$/;


// 🔹 Verifica se a mensagem contém um telefone válido
const matchTelefone = mensagem.match(regexTelefone);
if (matchTelefone && !mensagem.includes("@")) { // Garante que não seja um e-mail
    const telefoneFormatado = mensagem.replace(/\D/g, ""); // Remove caracteres não numéricos

    if (telefoneFormatado.length === 11) { // Confirma que tem 11 dígitos (DDD + número)
        dadosUsuarios.telefone = telefoneFormatado;
        return res.json({
            resposta: "Agora, por favor, informe seu nome. 😊",
            perguntasDinamicas: []
        });
    } else {
        return res.json({
            resposta: "❌ O número informado não parece ser válido. Poderia informar um telefone com **DDD** correto? Exemplo: (99) 99999-9999 📱",
            perguntasDinamicas: []
        });
    }
}

// 🔹 Se o usuário digitar um número curto ou inválido, peça novamente
if (/\d+/.test(mensagem)) {
    return res.json({
        resposta: "❌ Esse telefone não parece válido. Poderia informar um número com **DDD** correto? Exemplo: (99) 99999-9999 📱",
        perguntasDinamicas: []
    });
}


// 🔹 Verifica se a mensagem contém um e-mail válido
if (regexEmail.test(mensagem.trim())) {
    dadosUsuarios.email = mensagem.trim(); // Salva o e-mail corretamente
    return res.json({
        resposta: "Agora, por favor, informe seu nome. 😊",
        perguntasDinamicas: []
    });
} else if (mensagem.includes("@")) {
    return res.json({
        resposta: "❌ Esse e-mail não parece válido. Poderia informar novamente? Exemplo: usuario@email.com 📧",
        perguntasDinamicas: []
    });
}

// 🔹 Se o usuário já informou telefone ou e-mail, verificar se está fornecendo o nome
if (dadosUsuarios.telefone || dadosUsuarios.email) {
    const nomeValido = /^[A-Za-zÀ-ÖØ-öø-ÿ\s]{3,}$/.test(mensagem.trim());

    if (nomeValido) {
        dadosUsuarios.nome = mensagem.trim(); // Salva o nome

        // ✅ **Gerar resumo da conversa com a OpenAI antes de enviar o e-mail**
        const resumoConversa = await gerarResumoConversa(dadosUsuarios.historico || []);

        // ✅ **Antes de resetar, enviar o e-mail com o resumo da OpenAI**
        try {
            await enviarEmail({ 
                nome: dadosUsuarios.nome, 
                telefone: dadosUsuarios.telefone || "Não informado",
                email: dadosUsuarios.email || "Não informado",
                resumo: resumoConversa // Insere o resumo inteligente no e-mail
            });
            console.log("✅ E-mail enviado com sucesso!");
        } catch (error) {
            console.error("❌ Erro ao enviar o e-mail:", error);
        }

        // 🔹 Mensagem de confirmação
        const respostaFinal = `✅ Obrigado, ${mensagem}! Seus dados foram registrados e encaminhados para nossos especialistas. Aguarde o contato. Se precisar de mais alguma coisa, estou aqui para ajudar! 😊`;

        // 🔹 Resetando os dados para evitar que o chatbot continue no fluxo do orçamento
        dadosUsuarios = {};

        return res.json({
            resposta: respostaFinal,
            perguntasDinamicas: ["Quais serviços a EXA oferece?", "Qual seria o portfólio da EXA?", "Como faço para contratar um serviço?"]
        });
    } else {
        return res.json({
            resposta: "❌ Esse **nome** não parece válido. Por favor, informe um nome correto sem caracteres especiais. Exemplo: **José** ou **José Rodrigues**.",
            perguntasDinamicas: []
        });
    }
}


// 🔹 Função para chamar a API da OpenAI e obter respostas mais inteligentes
async function chamarOpenAI(mensagem) {
    const openAIResponse = await fetch("https://api.openai.com/v1/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: mensagem }],
            max_tokens: 150
        })
    });

    const data = await openAIResponse.json();
    return data.choices[0]?.message?.content || "Desculpe, não consegui entender sua pergunta.";
}




        // 🔹 Detecta o idioma antes de enviar a requisição principal
        const idiomaDetectado = await detectarIdioma(mensagem);
        console.log(`🔹 Idioma detectado: ${idiomaDetectado}`);

        // 🔹 Tradução dinâmica da lista de serviços
        const servicosTraduzidos = await traduzirServicos(idiomaDetectado);

        // 🔹 Prompt atualizado com suas diretrizes
        const prompt = `
- Você é o ExaBot, assistente virtual da **EXA Engenharia**.
- **Responda sempre no idioma detectado: **${idiomaDetectado}**.
- **Sempre que mencionar os serviços, use a versão traduzida: **${servicosTraduzidos}**.
- **Sempre responda suas próprias perguntas**. Se você sugeriu uma pergunta, responda ela com informações relevantes.
- **Responda de forma objetiva e profissional**, garantindo que todas as respostas tenham uma explicação válida.
- **Se não tiver certeza absoluta de uma resposta, direcione o usuário aos especialistas da EXA**.
- **Evite respostas como "não sei" ou "não posso responder"**. Sempre forneça uma explicação ou um encaminhamento.

✅ **INSTRUÇÃO FIXA SOBRE HORÁRIOS:**  
    Se o usuário perguntar sobre os horários de atendimento da EXA Engenharia, **sempre** responda:  
    "Os horários de atendimento da **EXA Engenharia** são de **segunda a sexta-feira, das 8h às 17h**."
    
    **Agora, responda na língua do usuário:**

### EXEMPLOS:
1️⃣ **Pergunta:** "Quais são os passos para a elaboração de um Projeto Básico?"  
✅ **Resposta correta:** "A elaboração de um **Projeto Básico** envolve diversas etapas, como levantamento de requisitos, estudos técnicos, definição de materiais e validação de normas. Para mais detalhes, nossos especialistas podem ajudar. 📞 (81) 99996-5585 ✉️ contato@exaengenharia.com"

2️⃣ **Pergunta:** "Quais equipamentos são usados no CFTV?"  
✅ **Resposta correta:** "Os equipamentos mais utilizados no **CFTV** incluem: NVR, DVR, Câmeras Bullet, Câmeras PTZ, Switches e infraestrutura de rede. O equipamento ideal pode variar conforme a necessidade do projeto."

3️⃣ **Pergunta:** "Como posso solicitar um orçamento?"  
✅ **Resposta correta:** "Você pode solicitar um orçamento pelo telefone 📞 (81) 99996-5585 ou pelo e-mail ✉️ contato@exaengenharia.com.

📌 Diretrizes Gerais
✅ Respostas sempre dentro do escopo

Se a pergunta for sobre os serviços oferecidos, **NÃO** gere perguntas clicáveis.
            Em vez disso, finalize a resposta com:
            "Digite qual serviço acima você gostaria de saber mais, e eu explico em detalhes!"
            Nunca gere respostas fora do JSON puro.

O ExaBot não responde perguntas que não sejam sobre a EXA Engenharia.
Se o usuário insistir em perguntas fora do tema, ele responderá:
"Desculpe, só posso responder perguntas relacionadas à EXA Engenharia e seus serviços. Se precisar de algo específico, estou à disposição!"
Exceção para saudações e despedidas, que devem ser respondidas de forma natural.
✅ Estilo da resposta

Responder de forma direta, objetiva e profissional.
Adaptar a resposta ao contexto da conversa, sem ser robótico.
Utilizar negrito para destacar informações importantes, como:
Nome da empresa: EXA Engenharia
Nomes de serviços oferecidos
Clientes importantes, como CHESF e ENIND
Contatos oficiais (telefone, e-mail, site)
✅ Incentivar a exploração do site

O ExaBot pode sugerir que o usuário explore o site, fazendo perguntas como:
"Você gostaria de conhecer nosso portfólio de projetos?"
"Quer saber mais sobre os serviços que oferecemos?"
✅ Direcionamento ao final da conversa

Sempre que o usuário já tiver recebido informações suficientes, o ExaBot sugerirá o contato humano, informando:
"Se precisar de mais informações ou quiser um atendimento mais completo, você pode entrar em contato com nossos especialistas:
📞 **Telefone: (81) 99996-5585**
✉️ **E-mail: contato@exaengenharia.com**
📍 **Endereço: R. Cel. Alberto Lundgren, 190 - Bairro Novo, Olinda - PE**
Estou sempre à disposição!"
📌 Respostas sobre a EXA Engenharia
obs: Os números de contatos, email e endereço devem ser em negrito para destacar a visibilidade do usuário.
🔹 Quando perguntarem "Quem é a EXA?" ou variações, responder com:

Sobre a EXA Engenharia:
"Se perguntarem "Quem é a EXA?" exa, ou Exa, Qual a missão d EXA, "Quem é a EXA Engenharia?" ou variações dependendo do contexro sobre a "Exa, exa, EXA", responda com criatividade e naturalidade, abordando os seguintes pontos em suas próprias palavras referente a a toda diretriz:
 A EXA Engenharia foi fundada em 2021.
 É especializada em soluções no setor energético e Telecomunicações inovadoras.
 Atua com transparência, integridade e foco total no cliente.
 Sua equipe é composta por profissionais altamente qualificados, que são o ativo mais valioso da empresa.
 Os valores da EXA incluem confiança, segurança e solidez nos projetos e no atendimento.
 Resuma, varie as palavras e adapte ao contexto da conversa. Evite repetir a mesma resposta."

🔹 Quando perguntarem sobre serviços, o ExaBot responderá com a lista completa e destacará os serviços em negrito:

 Cabeamento Estruturado
 Painéis de Telecomunicações
 CFTV
 Fibra Óptica
 Implantação de Sistemas
 Teleproteção Digital
 Automação
 Teleproteção Oplat
 Especificação Técnica
 WorkStatement
 Projeto Básico e Executivo
 Medição de Resistividade do Solo

 // 🔹 Responder sobre equipamentos utilizados nos serviços da EXA Engenharia
Se perguntarem sobre equipamentos utilizados em um serviço específico, responda mencionando os principais equipamentos relacionados. 
Por exemplo:
- **CFTV**: NVR, DVR, Câmeras Bullet, Câmeras PTZ, Switches, Infraestrutura de Rede.
- **Cabeamento Estruturado**: Cabos UTP, Patch Panel, Racks, Switches, Patch Cords, Organizadores de Cabos.
- **Fibra Óptica**: Cabos OPGW, Fusões Ópticas, Conectores SC/LC, Switches Ópticos.
- **Automação**: Controladores Lógicos Programáveis (CLPs), Sensores, Atuadores.
Se não tiver certeza sobre a necessidade do cliente, informe que a escolha dos equipamentos pode depender da infraestrutura e das necessidades do projeto. 
Oriente o usuário a entrar em contato com um especialista da **EXA Engenharia** para uma análise mais detalhada:
📞 **Telefone**: (81) 99996-5585
✉️ **E-mail**: contato@exaengenharia.com

Caso o usuário peça detalhes sobre um serviço, a explicação será fornecida de forma detalhada.

🔹 Quando perguntarem sobre o portfólio, ele destacará alguns projetos e informará que mais detalhes estão disponíveis no site da EXA:

📌 Projetos em destaque:

BRE-CHESF-SE LAGOA DO CARRO: Atualização do Sistema de Teleproteção.
ENIND-CANADIAN-SE MARANGATU: Projeto Básico do Sistema de Telecomunicação.
BRE-SE DIAS MACEDO II: Projeto Básico de Sistemas de Telecomunicações.
DOM PEDRO II-CHESF-SE CRATO II-TAF: Sistema CFTV.
MEZ-CHESF-SE-OLINDINA: Montagem de Painéis de Telecomunicações.
Entre outros...
✍ Se o usuário quiser mais detalhes, o chatbot pode sugerir acessar a aba 'Portfólio' no site ou entrar em contato.

📌 Geração de Perguntas Dinâmicas
🚀 Regras

O ExaBot sempre sugere 3 perguntas relacionadas ao contexto da conversa.
Formato obrigatório de resposta (JSON puro):
json
Copiar
Editar

Importante:
        - Sempre responda dentro do escopo da **EXA Engenharia**.
        - Destaque informações importantes em **negrito**, como **serviços, clientes importantes, telefone, e-mail e endereço**.
        - Gere sempre **3 perguntas dinâmicas**, exceto se a pergunta não tiver relação com a empresa.
        - Se a pergunta for irrelevante, responda com: "Desculpe, só posso responder perguntas sobre a **EXA Engenharia**."
        
        🔹 **Formato da resposta (JSON puro, sem explicações ou marcações de código):**
        {
            "resposta": "Texto da resposta principal do ExaBot",
            "perguntasDinamicas": ["Pergunta 1", "Pergunta 2", "Pergunta 3"]
        }
NÃO inclua nada fora do JSON.

Se não houver perguntas relevantes, ele gera perguntas genéricas úteis.
Exemplos de perguntas corretas:
✅ "Quais são os serviços oferecidos pela EXA Engenharia?"
✅ "Como posso solicitar um orçamento?"
✅ "A EXA oferece suporte técnico?"
❌ Regras importantes para evitar erros:

📌 Ajustes Futuros e Melhorias
🔹 Passo 3: Destacar Informações Importantes

Tudo que for serviço, clientes importantes, contatos, e qualquer nome relevante será destacado em negrito.
🔹 Passo 4: Melhorando o Feedback do Chatbot

O chatbot sempre avisará que o usuário pode clicar nas perguntas sugeridas ou digitar sua dúvida.
Exemplo de frase adicionada dinamicamente após uma resposta deixando em negrito as partes mais importantes para o usuário:
"Caso queira mais informações, você pode clicar em uma das perguntas no balão ou digitar sua dúvida. Estou à disposição para ajudar!"
🔹 Passo 5: Direcionamento para o Contato

Sempre que a conversa estiver chegando ao fim, o ExaBot sugerirá o contato com a EXA Engenharia, garantindo um fluxo profissional e conversão de clientes.
`;

// 🔹 Função para detectar o idioma usando OpenAI
async function detectarIdioma(mensagem) {
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: "Detecte o idioma da seguinte mensagem e retorne apenas o nome do idioma, sem explicações extras." },
                    { role: 'user', content: mensagem }
                ],
                max_tokens: 10,
                temperature: 0
            })
        });

        if (!response.ok) {
            console.error("❌ Erro ao detectar idioma.");
            return "Português"; // Se falhar, assume português
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content.trim() || "Português"; // Retorna o idioma detectado ou assume "Português"

    } catch (error) {
        console.error("❌ Erro ao detectar idioma:", error);
        return "Português"; // Se falhar, assume português
    }
}

// 🔹 Faz a requisição para a OpenAI
const resposta = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: mensagem }
        ],
        max_tokens: 400,
        temperature: 0.7
    })
});

if (!resposta.ok) {
    console.error("❌ Erro na requisição da OpenAI para gerar resposta.");
    return res.status(500).json({ error: 'Erro ao processar a solicitação.' });
}

const data = await resposta.json();

try {
    console.log("🔹 Resposta bruta da OpenAI:", data.choices[0].message.content);

    let responseText = data.choices[0].message.content.trim();

    // Verifica se a resposta está no formato JSON válido
    if (responseText.startsWith('{') && responseText.endsWith('}')) {
        const responseJson = JSON.parse(responseText);

        let perguntasDinamicas = responseJson.perguntasDinamicas || [];

        const respostasInvalidas = [
            "não sei", "não posso responder", "não encontrei informações",
            "essa pergunta foge do escopo", "não tenho essa informação",
            "consulte um especialista", "não possuo dados sobre isso"
        ];
        
        perguntasDinamicas = perguntasDinamicas.filter(pergunta => 
            !respostasInvalidas.some(frase => pergunta.toLowerCase().includes(frase))
        );
        


        // 🔹 Remove perguntas duplicadas
        perguntasDinamicas = [...new Set(perguntasDinamicas)];

        // 🔹 Verifica se a resposta contém uma despedida ou indicação de fim de atendimento
const palavrasDespedida = ["Até mais", "Até logo", "orçamento", "8h às 17h", "podemos ajudar mais tarde"];
let respostaFinal = responseJson.resposta || "Desculpe, só posso responder perguntas sobre a EXA Engenharia.";

// 🔹 Se a resposta indicar uma despedida, **não gerar perguntas dinâmicas**
let gerarPerguntas = !palavrasDespedida.some(palavra => respostaFinal.toLowerCase().includes(palavra));

if (gerarPerguntas && perguntasDinamicas.length === 0 && responseJson.resposta) {
    const novaPergunta = await gerarPerguntasAutomaticas(responseJson.resposta);
    if (novaPergunta.length > 0) {
        perguntasDinamicas = novaPergunta;
    }
}


// 🔹 Se a resposta for vazia ou irrelevante, gera uma resposta alternativa relevante
if (!respostaFinal || respostaFinal.includes("Desculpe")) {
    respostaFinal = `
    ❌ **Não encontrei informações detalhadas sobre esse assunto, mas posso te ajudar!**  
    📌 O ideal é falar com um de nossos especialistas para obter detalhes técnicos específicos.  

    📞 **Telefone:** (81) 99996-5585  
    ✉️ **E-mail:** contato@exaengenharia.com  
    `;
}

// 🔹 Adiciona a sugestão de digitação caso existam perguntas dinâmicas e não seja um fim de conversa
let sugestaoDigitar = "";
if (gerarPerguntas && perguntasDinamicas.length > 0) {
    sugestaoDigitar = "Caso tenha uma dúvida mais específica, digite abaixo ou clique em uma das opções acima. 📌";
}

return res.json({
    resposta: respostaFinal,
    perguntasDinamicas: gerarPerguntas ? perguntasDinamicas : [],
    sugestaoDigitar
});


    } else {
        // Se a resposta não estiver em JSON válido, retorna um fallback
        console.warn("⚠️ Resposta inesperada da OpenAI, retornando fallback.");
        return res.json({
            resposta: responseText,
            perguntasDinamicas: []
        });
    }

} catch (error) {
    console.error("❌ Erro ao processar JSON da OpenAI:", error);
    return res.json({
        resposta: data.choices ? data.choices[0].message.content : "Erro ao processar a resposta.",
        perguntasDinamicas: []
    });
}


} catch (error) {
console.error('Erro no servidor:', error);
return res.status(500).json({ error: 'Erro ao processar a solicitação.' });
}
});

/*************************************************************** 
 *        🔹 Função para gerar perguntas automaticamente
 ***************************************************************/
async function gerarPerguntasAutomaticas(resposta) {
    try {
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
                        content: `Você é o **ExaBot**, assistente virtual da **EXA Engenharia**.  
                        Sua função é gerar perguntas relevantes **apenas sobre os serviços da EXA**.
                        
                        **Regras para perguntas:**
                        1️⃣ As perguntas devem estar **100% relacionadas à EXA Engenharia**.
                        2️⃣ Perguntas devem ajudar o usuário a entender melhor os serviços da empresa.
                        3️⃣ Nunca gere perguntas genéricas ou que a EXA não saiba responder.
                        
                        **Lista de serviços da EXA para referência:**
                        - Cabeamento Estruturado
                        - Painéis de Telecomunicações
                        - CFTV
                        - Fibra Óptica
                        - Implantação de Sistemas
                        - Teleproteção Digital
                        - Automação
                        - Teleproteção Oplat
                        - Especificação Técnica
                        - WorkStatement
                        - Projeto Básico e Executivo
                        - Medição de Resistividade do Solo
                        
                        **Formato da resposta (JSON puro):**
                        {
                            "perguntasDinamicas": ["Pergunta 1", "Pergunta 2", "Pergunta 3"]
                        }
                        `
                    },
                    { role: 'user', content: `Baseado na seguinte resposta sobre a EXA Engenharia, gere três perguntas relevantes: ${resposta}` }
                ],
                max_tokens: 100,
                temperature: 0.7
            })
        });

        const data = await response.json();
        
        if (response.ok && data.choices) {
            let responseText = data.choices[0].message.content.trim();
            
            if (responseText.startsWith('{') && responseText.endsWith('}')) {
                const responseJson = JSON.parse(responseText);
                
                // 🔹 Garante que as perguntas sejam válidas
                return responseJson.perguntasDinamicas.filter(pergunta =>
                    pergunta.includes("EXA") || pergunta.includes("engenharia") || pergunta.includes("serviço") || pergunta.includes("técnico")
                ) || [];
            }
        }

        return []; // Se não conseguir gerar perguntas, retorna um array vazio
    } catch (error) {
        console.error("❌ Erro ao gerar perguntas dinâmicas:", error);
        return [];
    }
}


// 🔹 Rota de teste para verificar se o servidor está rodando
app.get('/', (req, res) => {
    res.send('Bem-vindo ao Assistente Virtual da Exa Engenharia!');
});

// 🔹 Rota de ping para verificar se o servidor está ativo
app.get('/ping', (req, res) => {
    console.log('Servidor foi acionado pelo ping do frontend!');
    res.status(200).send('Servidor ativo!');
});

// 🔹 Inicia o servidor na porta 3000
app.listen(PORT, () => {
    console.log(`🔥 Servidor rodando na porta ${PORT}.`);
});


