import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx-js-style';

import { getSheetData } from "./components/get_sheet_data.js"
import { getExcelColumnLabel } from "./components/get_exel_column_label.js"
import { Student } from "./components/student.js"
import { handleFileUpload } from "./components/handle_file_upload.js"

import * as Style from "./components/style_library.js"

const formTestAnswers = document.querySelector('#get_unformatted_answer_keys')
let fileWorkbook
var file

fetch('../assets/data/list_background_colors.json')
    .then(response => response.json())
    .then(data => {
    const coffees = Object.entries(data)

    let i = getRandomArbitrary(0, coffees.length-1)
    switchBackground();
    
    document.querySelector(".switch_background").addEventListener('click', (event) => {
        if (i < coffees.length - 1) {
        i++
        } else {
        i = 0
        }
        switchBackground();
    });

    function switchBackground() {
        document.querySelector('.switch_background > span').innerHTML = coffees[i][0];
        document.querySelector('.area').style.setProperty('--backgrond_color', coffees[i][1]);
    }
});

function getRandomArbitrary(min, max) {
    return parseInt(Math.random() * (max - min) + min)
}

//Função pra baixar a Planilha Modelo
document.querySelector('#btn_download_model_spreadsheet').addEventListener('click', () => {
    // Função para ler o arquivo e criar um Blob
    fetch('../assets/spreadsheets/gabarito_modelo.xlsx')
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => {
        const blob = new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet ' });
        const fileName = 'gabarito_modelo.xlsx'; // Nome do arquivo a ser exibido no download
        saveAs(blob, fileName)
    })
    .catch(error => {
        console.error('Erro ao baixar o arquivo:', error);
    });
})


//Recebendo o Formulario
formTestAnswers.querySelector('input').addEventListener('change', (event) => {
    formTestAnswers.dispatchEvent(new Event('submit', { cancelable: true }))
    
})
formTestAnswers.addEventListener('submit', (event) => {
    event.preventDefault()

    const inpFile = formTestAnswers.querySelector('input')
    file = inpFile.files[0]

    handleFileUpload(file)
    .then(workbook => {
        fileWorkbook = workbook

        //Verificando Se o arrivo tem pelo menos mais de 4 linha na platilha
        if (getSheetData(0, fileWorkbook).filter((_, index) => index != 0).length <= 4) {
            alert("Arquivo Irregular!")
            setTimeout(() => {
                formTestAnswers.querySelector('input').click();
            }, 100)
        }
        else {
            startHandle()
        }
    })
    .catch(error => {
        alert(error.message)
        console.error("Erro:", error)
    })
})

//Lidando com envio do formulario
function startHandle () {

    // Criando o workbook e adicionando a planilha
    const workbook = XLSX.utils.book_new();
    for (
        let i = 0; 
        i < fileWorkbook.SheetNames.length; 
        i++
    ) {
        const data = getSheetData(i, fileWorkbook).filter((_, index) => index != 0)
        const title = getSheetData(i, fileWorkbook)[0][0] 

        const worksheet = generateSpreadsheet(refineData(data, title))

        XLSX.utils.book_append_sheet(workbook, worksheet, fileWorkbook.SheetNames[i]);
    }

    saveFile(workbook)
}

function refineData(rawData, title) {
    const data = []

    const rowNumbers = 0
    const rowDisciplines = 1
    const rowAnswerKey = 2
    
    //Gabarito
    const answerKey = new Student(rawData[2][0], [rawData[rowNumbers], rawData[rowDisciplines], rawData[rowAnswerKey]])

    let header = ['Nomes', `Precisão\nGeral`, `Acertos\nGeral`, `Total\nGeral`]
    for (
        let j = 0;
        j < answerKey.disciplines.length;
        j++
    ) {
        let name = answerKey.disciplines[j].name
        header = header.concat([`Precisão\n${name}`, `Acertos\n${name}`, `Total\n${name}`])
    }
    
    const mainHeader = [
        [title],
        header
    ]



    //Vai rodar todos os Alunos
    const numStudents = (rawData.length-(rowAnswerKey + 1))
    for (
        let i = rowAnswerKey + 1;
        i < rawData.length;
        i++
    ) {
        let student = new Student(rawData[i][0], [rawData[rowNumbers], rawData[rowDisciplines], rawData[i]])

        let overallScore = 0
        let overallQuestions = 0

        const headerByDiscipline = []


        //Vai rodar todas as disciplinas do aluno
        for (
            let j = 0;
            j < student.disciplines.length;
            j++
        ) {
            const discipline = student.disciplines[j];
            discipline.validateAnswers(answerKey.disciplines[j])

            let score = discipline.rightQuestions.length
            let questions = discipline.answers.length

            headerByDiscipline.push('%', score, questions)

            overallScore += score
            overallQuestions += questions
        }

        const rowData = [student.name, '%', overallScore, overallQuestions].concat(headerByDiscipline)        
        data.push(rowData)
    }

    let footByD = []
    
    let overR = 0
    let overQ = 0
    
    //Vai rodar todas as disciplinas que exitem
    for (let i = 0; i < answerKey.disciplines.length; i++) {
        let allR = 0
        let allQ = 0

        //Vai rodar todos os alunos
        for (let j = rowAnswerKey + 1; j < rawData.length; j++) {
            let s = new Student(rawData[j][0], [rawData[rowNumbers], rawData[rowDisciplines], rawData[j]])
            const d = s.disciplines[i];
            d.validateAnswers(answerKey.disciplines[i])

            allR += d.rightQuestions.length
            allQ += d.answers.length
        }
        footByD.push('%', parseInt((allR)/numStudents), answerKey.disciplines[i].answers.length)

        overR += allR
        overQ += allQ
    }
    
    const rowFooter = ["Média da Classe", '%', parseInt(overR/numStudents), parseInt(overQ/numStudents)].concat(footByD)
    
    data.push(rowFooter)
    const worksheetData = mainHeader.concat(data)

    return worksheetData
}

function generateSpreadsheet(worksheetData) {    
    let worksheet = XLSX.utils.aoa_to_sheet(worksheetData)

    // Aplicar fórmulas e formatar a coluna de porcentagem como % (B)
    for (
        let i = 3;
        i < worksheetData.length + 2;
        i++
    ) {  // Começa na terceira linha
        for (
            let j = 0;
            j < worksheetData[1].length;
            j++
        ) {
            const cell = worksheet[`${getExcelColumnLabel(j)}${i}`];
            
            if (cell) {
                if (cell.v == '%') {
                    cell.f = `=(${getExcelColumnLabel(j+1)}${i}/${getExcelColumnLabel(j+2)}${i})`
                    cell.z = '0%';  // Formatar como porcentagem
                }
            }
        }
    }
    
    worksheet = Style.stylize(worksheet, worksheetData)
    return worksheet
}


function saveFile(workbook) {
    // Gerando o arquivo Excel e baixando
    const arquivoExcel = XLSX.write(workbook, { bookType: 'xlsx', type: 'binary' });
    const buffer = new ArrayBuffer(arquivoExcel.length);
    const view = new Uint8Array(buffer);

    for (let i = 0; i < arquivoExcel.length; i++) {
        view[i] = arquivoExcel.charCodeAt(i) & 0xFF;
    }

    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    saveAs(blob, `${formatFileName(file.name)}_resultados.xlsx`);
}

function formatFileName(fileName) {
    // Remove a extensão .xlsx
    const nameWithoutExtension = fileName.replace('.xlsx', '');

    // Substitui os espaços por underscore (_) e converte para minúsculas
    const formattedName = nameWithoutExtension.trim().toLowerCase().replace(/\s+/g, '_');
    
    return formattedName + '_';  // Adiciona o underscore no final
}

let degug = false

let sPressed = false;
let fPressed = false;

document.addEventListener('keydown', (event) => {
        if (event.key === 's') {
            sPressed = true;
        } else if (event.key === 'f') {
            fPressed = true;
        } else if (event.key === 'F12') {
            degug = !degug;
        }

        console.log(degug, sPressed, fPressed);
        
    

        if (sPressed && fPressed && degug) {
            degug = false
            fetch("../assets/spreadsheets/Modelo de Gabarito Street Fighter.xlsx")
            .then(response => response.blob())  // Converta a resposta em um blob (arquivo)
            .then(blob => {
                file = new File([blob], 'arquivo.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
                    return handleFileUpload(file);  // Chame sua função com o "file"
            })
            .then(workbook => {
                fileWorkbook = workbook;
                startHandle();
            })
            .catch(error => console.error('Erro ao carregar o arquivo:', error));
        }
    });

    document.addEventListener('keyup', (event) => {
    if (event.key === 's') {
        sPressed = false;
    } else if (event.key === 'f') {
        fPressed = false;
    }
})