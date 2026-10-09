Attribute VB_Name = "AppSend"
Option Explicit

' ============================================================
' ОТПРАВКА В ПРИЛОЖЕНИЕ «Листовой материал» (раздел «Расход»)
' Данные берутся из того же текстового объекта, что и для Excel.
' Макрос отправляет их через облако - открытое приложение само подставляет их
' в форму расхода: материал, размер листа, кол-во, размер изделия
' и примечание (номер заказа_заказчик, например 9-08-77_Талан).
' Расход НЕ записывается сам - вы проверяете поля и жмёте кнопку в приложении.
' ============================================================

' >>> 1. Ваш код доступа к приложению (тот, что показан в шапке приложения) <<<
Private Const ACCESS_CODE As String = "ВПИШИТЕ_КОД"

' >>> 2. (необязательно) ID установленного приложения Chrome - макрос будет само его
'        открывать/выводить на передний план. Где взять - см. инструкцию. Пусто = не открывать. <<<
Private Const CHROME_APP_ID As String = ""
Private Const CHROME_PROFILE As String = "Default"

' >>> 3. Адрес приложения - только для запасного варианта (если облако недоступно) <<<
Private Const APP_URL As String = "https://server1988.github.io/materials/"

' Данные облака (те же, что в приложении)
Private Const SB_URL As String = "https://yqchdjnlblgmeugqpamu.supabase.co"
Private Const SB_KEY As String = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxY2hkam5sYmxnbWV1Z3FwYW11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2ODY1NTEsImV4cCI6MjA5MTI2MjU1MX0._wdyti574OjkiJEhciruc1bneaifuzDT9OQwAuUQaM0"

#If VBA7 Then
    Private Declare PtrSafe Function ShellExecute Lib "shell32.dll" Alias "ShellExecuteA" _
        (ByVal hwnd As LongPtr, ByVal lpOperation As String, ByVal lpFile As String, _
         ByVal lpParameters As String, ByVal lpDirectory As String, ByVal nShowCmd As Long) As LongPtr
#Else
    Private Declare Function ShellExecute Lib "shell32.dll" Alias "ShellExecuteA" _
        (ByVal hwnd As Long, ByVal lpOperation As String, ByVal lpFile As String, _
         ByVal lpParameters As String, ByVal lpDirectory As String, ByVal nShowCmd As Long) As Long
#End If

Sub ОтправитьВПриложение()
    ' Выделите ОДИН текстовый объект с данными (тот же, что для Excel)
    Dim s As Shape
    Dim textContent As String
    Dim parts(8) As String
    Dim material As String, detail As String, sheet As String, qty As String
    Dim orderNote As String
    Dim errText As String

    If ActiveSelection.Shapes.Count <> 1 Then
        MsgBox "Выделите один текстовый объект с данными", vbExclamation
        Exit Sub
    End If

    Set s = ActiveSelection.Shapes(1)

    If s.Type <> cdrTextShape Then
        MsgBox "Выделенный объект не является текстом", vbExclamation
        Exit Sub
    End If

    textContent = s.Text.Story.Text
    textContent = Replace(textContent, vbCrLf, " ")
    textContent = Replace(textContent, vbLf, " ")
    textContent = Replace(textContent, vbCr, " ")
    textContent = Trim(textContent)

    If Not ParseTextDataApp(textContent, parts) Then
        MsgBox "Не удалось распарсить данные из текста." & vbCrLf & vbCrLf & _
               "Текст: " & Left(textContent, 100), vbExclamation
        Exit Sub
    End If

    ' Части текста (как в макросе для Excel): 0 - номер заказа, 1 - заказчик, 3 - материал,
    ' 4 - размер детали, 5 - размер листа, 6 - кол-во
    material = Trim(parts(3))
    detail = Trim(parts(4))
    sheet = Trim(parts(5))
    qty = Trim(parts(6))
    If Not IsNumeric(qty) Or qty = "" Then qty = "1"

    ' Примечание: 1-я и 2-я части через "_" (номер заказа_заказчик)
    orderNote = Trim(parts(0))
    If Trim(parts(1)) <> "" Then
        If orderNote <> "" Then orderNote = orderNote & "_"
        orderNote = orderNote & Trim(parts(1))
    End If

    If material = "" Then
        MsgBox "В тексте не найден материал.", vbExclamation
        Exit Sub
    End If

    If ACCESS_CODE = "ВПИШИТЕ_КОД" Then
        MsgBox "В начале макроса впишите свой код доступа (ACCESS_CODE).", vbExclamation
        Exit Sub
    End If

    errText = SendToCloud(material, detail, sheet, qty, orderNote)

    If errText = "" Then
        LaunchChromeApp
    Else
        If MsgBox("Не удалось отправить через облако:" & vbCrLf & errText & vbCrLf & vbCrLf & _
                  "Открыть приложение в браузере с этими данными?", vbQuestion + vbYesNo) = vbYes Then
            OpenInBrowser material, detail, sheet, qty, orderNote
        End If
    End If
End Sub

Private Function SendToCloud(material As String, detail As String, sheet As String, qty As String, note As String) As String
    ' Кладёт данные в строку "<код>::inbox" таблицы material_data. Возвращает "" при успехе или текст ошибки.
    On Error GoTo EH

    Dim http As Object
    Dim uid As String, stamp As String, body As String

    uid = Format(Now, "yyyymmddhhnnss") & Format(Int((Timer - Int(Timer)) * 1000), "000")
    stamp = Format(Now, "yyyy-mm-dd") & "T" & Format(Now, "hh:nn:ss")   ' местное время этого компьютера

    body = "{""id"":""" & JsonStr(ACCESS_CODE & "::inbox") & """," & _
           """payload"":{""id"":""" & uid & """," & _
           """t"":""" & stamp & """," & _
           """mat"":""" & JsonStr(material) & """," & _
           """det"":""" & JsonStr(detail) & """," & _
           """sheet"":""" & JsonStr(sheet) & """," & _
           """qty"":" & CLng(Val(qty)) & "," & _
           """note"":""" & JsonStr(note) & """}," & _
           """updated_at"":""" & stamp & """}"

    Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
    http.setTimeouts 5000, 5000, 10000, 10000
    http.Open "POST", SB_URL & "/rest/v1/material_data", False
    http.setRequestHeader "apikey", SB_KEY
    http.setRequestHeader "Authorization", "Bearer " & SB_KEY
    http.setRequestHeader "Content-Type", "application/json"
    http.setRequestHeader "Prefer", "resolution=merge-duplicates,return=minimal"
    http.send body

    If http.Status >= 200 And http.Status < 300 Then
        SendToCloud = ""
    Else
        SendToCloud = "HTTP " & http.Status & ": " & Left(http.responseText, 150)
    End If
    Exit Function

EH:
    SendToCloud = "нет связи с облаком (" & Err.Description & ")"
End Function

Private Sub LaunchChromeApp()
    ' Выводит установленное приложение Chrome на передний план (если указан CHROME_APP_ID)
    If CHROME_APP_ID = "" Then Exit Sub
    On Error Resume Next

    Dim proxy As String
    Dim candidates As Variant
    Dim i As Long

    candidates = Array( _
        Environ("ProgramFiles") & "\Google\Chrome\Application\chrome_proxy.exe", _
        Environ("ProgramFiles(x86)") & "\Google\Chrome\Application\chrome_proxy.exe", _
        Environ("LocalAppData") & "\Google\Chrome\Application\chrome_proxy.exe")

    For i = 0 To UBound(candidates)
        If Dir(candidates(i)) <> "" Then
            proxy = candidates(i)
            Exit For
        End If
    Next i

    If proxy = "" Then Exit Sub
    Shell """" & proxy & """ --profile-directory=""" & CHROME_PROFILE & """ --app-id=" & CHROME_APP_ID, vbNormalFocus
End Sub

Private Sub OpenInBrowser(material As String, detail As String, sheet As String, qty As String, note As String)
    ' Запасной вариант: открыть приложение в браузере со ссылкой, в которой зашиты данные
    Dim url As String
    url = APP_URL & "?add=expense" & _
          "&mat=" & UrlEncodeUtf8(material) & _
          "&det=" & UrlEncodeUtf8(detail) & _
          "&qty=" & UrlEncodeUtf8(qty)
    If sheet <> "" Then url = url & "&sheet=" & UrlEncodeUtf8(sheet)
    If note <> "" Then url = url & "&note=" & UrlEncodeUtf8(note)
    If ShellExecute(0, "open", url, vbNullString, vbNullString, 1) <= 32 Then
        MsgBox "Не удалось открыть приложение по адресу:" & vbCrLf & APP_URL, vbCritical
    End If
End Sub

Private Function ParseTextDataApp(ByVal textContent As String, ByRef parts() As String) As Boolean
    ' Та же логика, что в ParseTextData для Excel: текст делится по "_",
    ' после 8-го подчёркивания идёт адрес файла (здесь он не нужен).
    Dim underscoreCount As Integer
    Dim i As Long
    Dim cutPos As Long
    Dim firstPart As String
    Dim arr As Variant
    Dim k As Integer

    textContent = Trim(textContent)

    For i = 1 To Len(textContent)
        If Mid(textContent, i, 1) = "_" Then
            underscoreCount = underscoreCount + 1
            If underscoreCount = 8 Then
                cutPos = i
                Exit For
            End If
        End If
    Next i

    If underscoreCount < 8 Then Exit Function

    firstPart = Left(textContent, cutPos - 1)
    arr = Split(firstPart, "_")
    If UBound(arr) < 7 Then Exit Function

    For k = 0 To 7
        parts(k) = CStr(arr(k))
    Next k
    ParseTextDataApp = True
End Function

Private Function JsonStr(ByVal s As String) As String
    ' Строка для JSON: кириллица и прочее не-ASCII записывается как \uXXXX (без проблем с кодировкой)
    Dim i As Long
    Dim c As Long
    Dim result As String

    For i = 1 To Len(s)
        c = AscW(Mid$(s, i, 1))
        If c < 0 Then c = c + 65536
        Select Case c
            Case 34
                result = result & "\"""
            Case 92
                result = result & "\\"
            Case 32 To 126
                result = result & ChrW$(c)
            Case Else
                result = result & "\u" & Right$("0000" & Hex$(c), 4)
        End Select
    Next i

    JsonStr = result
End Function

Private Function UrlEncodeUtf8(ByVal s As String) As String
    ' Кодирование в %XX (UTF-8) - для запасного варианта со ссылкой
    Dim i As Long
    Dim c As Long
    Dim result As String

    For i = 1 To Len(s)
        c = AscW(Mid$(s, i, 1))
        If c < 0 Then c = c + 65536
        Select Case c
            Case 48 To 57, 65 To 90, 97 To 122, 45, 46, 95, 126
                result = result & ChrW$(c)
            Case Is < 128
                result = result & "%" & Right$("0" & Hex$(c), 2)
            Case Is < 2048
                result = result & "%" & Hex$(192 Or (c \ 64)) & "%" & Hex$(128 Or (c And 63))
            Case Else
                result = result & "%" & Hex$(224 Or (c \ 4096)) & _
                                  "%" & Hex$(128 Or ((c \ 64) And 63)) & _
                                  "%" & Hex$(128 Or (c And 63))
        End Select
    Next i

    UrlEncodeUtf8 = result
End Function
