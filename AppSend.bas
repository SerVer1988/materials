Attribute VB_Name = "AppSend"
Option Explicit

' ============================================================
' ЛИСТОВОЙ МАТЕРИАЛ - макросы CorelDRAW для приложения (один модуль)
'
' ПОРЯДОК РАБОТЫ
'   1) Зашли в новый файл:  ОткрытьЗаказ  - заносит в приложение все материалы заказа ("нужно")
'      и показывает, какие листы и обрезки есть в наличии, а каких нет.
'   2) Режете: ваша плашка (макрос ОбработатьВыделение) формирует строку, отправляет в Excel и вызывает
'      ОтправитьСтрокуВПриложение - "вырезано" уходит в приложение с реальным размером объектов.
'   3) Деталь испорчена: макрос ОбработатьБрак (та же плашка) - уходит только в брак, деталь вернётся в заказ.
'   4) Заказ готов:  ЗакрытьЗаказ.   Все пункты открытия/закрытия в одном окне: Меню.
'   Заказ = имя файла (без .cdr), категорию внутри файла можно менять.
'
' Формат подписи детали (части через "_", нужны первые 8, дальше путь к файлу):
'   Номер_Заказчик_Что именно_Материал_Размер детали_Размер листа_Кол-во листов_Длина реза(мм)_путь к файлу
'
' ВАЖНО: перед импортом удалите из проекта старые модули: AppSend, SendOrder, макрос заявки в ПЛАН
' (ОтправитьВПлан) и GenerateArtisticOrderText - всё это теперь в этом модуле.
' ============================================================

' >>> Код доступа к приложению (показан в шапке приложения) <<<
Private Const ACCESS_CODE As String = "BOTSAD27"
' >>> Рисовать на листе блок с материалами заказа (как раньше GenerateArtisticOrderText) <<<
Private Const DRAW_BLOCK As Boolean = True
' >>> Сколько секунд ждать ответ приложения про наличие <<<
Private Const REPLY_WAIT_SEC As Long = 15
' >>> Минимальный размер шрифта подписей, которые читает ОткрытьЗаказ (мелкие технические тексты пропускаются) <<<
Private Const LABEL_MIN_SIZE As Double = 38

' (необязательно) Chrome-приложение: ID, чтобы макрос выводил его на передний план. Пусто = не открывать.
Private Const CHROME_APP_ID As String = ""
Private Const CHROME_PROFILE As String = "Default"
' Адрес приложения - только для запасного варианта (если облако недоступно)
Private Const APP_URL As String = "https://server1988.github.io/materials/"

' Данные облака (те же, что в приложении)
Private Const SB_URL As String = "https://yqchdjnlblgmeugqpamu.supabase.co"
Private Const SB_KEY As String = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxY2hkam5sYmxnbWV1Z3FwYW11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2ODY1NTEsImV4cCI6MjA5MTI2MjU1MX0._wdyti574OjkiJEhciruc1bneaifuzDT9OQwAuUQaM0"

#If VBA7 Then
    Private Declare PtrSafe Function ShellExecute Lib "shell32.dll" Alias "ShellExecuteA" _
        (ByVal hwnd As LongPtr, ByVal lpOperation As String, ByVal lpFile As String, _
         ByVal lpParameters As String, ByVal lpDirectory As String, ByVal nShowCmd As Long) As LongPtr
    Private Declare PtrSafe Sub Sleep Lib "kernel32" (ByVal dwMilliseconds As Long)
#Else
    Private Declare Function ShellExecute Lib "shell32.dll" Alias "ShellExecuteA" _
        (ByVal hwnd As Long, ByVal lpOperation As String, ByVal lpFile As String, _
         ByVal lpParameters As String, ByVal lpDirectory As String, ByVal nShowCmd As Long) As Long
    Private Declare Sub Sleep Lib "kernel32" (ByVal dwMilliseconds As Long)
#End If

' ============================================================
'  ТОЧКИ ВХОДА
' ============================================================

Sub Меню()
    Dim ans As String
    ans = InputBox("Что сделать?" & vbCrLf & vbCrLf & _
        "1 - Открыть заказ (материалы в приложение + наличие)" & vbCrLf & _
        "2 - Закрыть заказ" & vbCrLf & _
        "3 - Только блок материалов на листе (без отправки)", "Листовой материал", "1")
    Select Case Trim(ans)
        Case "1": ОткрытьЗаказ
        Case "2": ЗакрытьЗаказ
        Case "3": БлокМатериалов
    End Select
End Sub

' 1) Зашли в файл: все материалы заказа - в приложение ("нужно"), и ответ: какие листы есть, каких нет
Sub ОткрытьЗаказ()
    Dim key As String, planText As String, errText As String
    Dim msgId As String, reply As String
    Dim cancelled As Boolean

    If ActiveDocument Is Nothing Then
        MsgBox "Нет открытого документа!", vbCritical
        Exit Sub
    End If

    key = DocOrderKey()
    If key = "" Then
        MsgBox "Не удалось определить заказ по имени файла.", vbExclamation
        Exit Sub
    End If

    If Not BuildOrderText(key, planText, cancelled) Then
        If Not cancelled Then MsgBox "На листе не найдено ни одной подписи с материалом и размером.", vbExclamation
        Exit Sub
    End If

    If DRAW_BLOCK Then DrawOrderBlock planText

    errText = SendPlanToCloud(key, planText, msgId)
    If errText <> "" Then
        MsgBox "Не удалось отправить заявку в приложение:" & vbCrLf & errText, vbExclamation
        Exit Sub
    End If

    reply = WaitReply(msgId)
    If reply = "" Then
        MsgBox "Заявка отправлена (заказ " & key & ")." & vbCrLf & vbCrLf & _
               "Приложение не ответило за " & REPLY_WAIT_SEC & " с. Откройте его (хотя бы на одном устройстве): " & _
               "материалы появятся сами, наличие будет видно в «План - Закупка».", vbInformation, "Открыть заказ"
    Else
        MsgBox "Заказ: " & key & vbCrLf & vbCrLf & reply, vbInformation, "Наличие материалов"
    End If
End Sub

' Только блок с материалами на листе (без отправки)
Sub БлокМатериалов()
    Dim key As String, planText As String
    Dim cancelled As Boolean
    If ActiveDocument Is Nothing Then Exit Sub
    key = DocOrderKey()
    If Not BuildOrderText(key, planText, cancelled) Then Exit Sub
    DrawOrderBlock planText
End Sub

' 2) Принять ГОТОВУЮ строку из вашего макроса-плашки и отправить в приложение.
'    rawText - то, что уже формирует ваш макрос: Номер_Заказчик_Категория_Материал_Размер_Лист_Кол-во_Длина реза_ПутьКФайлу
'    isBrak = True - уходит только в брак. Размер изделия берётся из строки (у вас он уже считается по реальным объектам).
Public Sub ОтправитьСтрокуВПриложение(ByVal rawText As String, Optional ByVal isBrak As Boolean = False)
    Dim textContent As String, errText As String, key As String
    Dim parts(8) As String
    Dim filePath As String
    Dim material As String, detail As String, sheet As String, qty As String
    Dim category As String, cutLen As String

    textContent = OneLine(rawText)

    errText = ValidateLabel(textContent, key)
    If errText <> "" Then
        MsgBox "В приложение НЕ отправлено - ошибка в строке:" & vbCrLf & vbCrLf & errText & vbCrLf & vbCrLf & _
               "Нужно: Номер_Заказчик_Что именно_Материал_Размер_Лист_Кол-во_Длина реза_Путь к файлу", _
               vbCritical, "Приложение: проверка строки"
        Exit Sub
    End If
    If Not ParseTextDataApp(textContent, parts, filePath) Then
        MsgBox "В приложение НЕ отправлено: не удалось разобрать строку.", vbCritical, "Приложение"
        Exit Sub
    End If

    material = NormSpaces(parts(3))
    detail = Trim(parts(4))
    sheet = Trim(parts(5))
    qty = Trim(parts(6))
    If Not IsNumeric(qty) Or qty = "" Then qty = "1"
    category = Trim(parts(2))
    cutLen = Trim(parts(7))
    If Not IsNumeric(cutLen) Then cutLen = ""

    errText = SendToCloud(material, detail, sheet, qty, key, category, cutLen, "", isBrak)
    If errText = "" Then
        LaunchChromeApp
    Else
        MsgBox "В приложение НЕ отправлено:" & vbCrLf & errText, vbExclamation, "Приложение"
    End If
End Sub

' 3) Заказ готов: закрыть
Sub ЗакрытьЗаказ()
    Dim key As String, errText As String
    If ActiveDocument Is Nothing Then Exit Sub
    key = DocOrderKey()
    If key = "" Then
        MsgBox "Не удалось определить заказ по имени файла.", vbExclamation
        Exit Sub
    End If
    If MsgBox("Закрыть заказ " & key & "?" & vbCrLf & vbCrLf & "Итог (экономия или перерасход) попадёт в «Итоги».", vbYesNo + vbQuestion, "Закрыть заказ") = vbNo Then Exit Sub
    errText = SendCommandToCloud("closeOrder", key)
    If errText <> "" Then MsgBox "Не удалось отправить команду:" & vbCrLf & errText, vbExclamation
End Sub

' ============================================================
'  ЗАЯВКА ПО ЛИСТУ: материалы из всех подписей
' ============================================================

Private Function DocOrderKey() As String
    ' Заказ = имя открытого файла без .cdr
    Dim n As String
    On Error Resume Next
    n = ActiveDocument.Name
    If LCase(Right(n, 4)) = ".cdr" Then n = Left(n, Len(n) - 4)
    DocOrderKey = Trim(n)
End Function

Private Function OneLine(ByVal t As String) As String
    t = Replace(t, vbCrLf, " ")
    t = Replace(t, vbLf, " ")
    t = Replace(t, vbCr, " ")
    OneLine = Trim(t)
End Function

Private Function BuildOrderText(ByVal fileKey As String, ByRef outText As String, ByRef cancelled As Boolean) As Boolean
    ' Читает все крупные подписи на странице: материал + размер детали -> строки "Материал - лист (деталь) - N листа".
    Dim doc As Document
    Dim oldBlock As ShapeRange
    Dim sh As Shape
    Dim orderNumber As String, customerName As String
    Dim underscorePos As Long
    Dim txtContent As String, cleanText As String
    Dim materialsInfo As String
    Dim complexMat As Variant, simpleMat As Variant
    Dim regEx As Object, matches As Object
    Dim detW As Double, detH As Double
    Dim matchedMaterial As String
    Dim calcResult As String, parsedFormat As String, parsedType As String
    Dim pipePos As Long
    Dim fullKey As String
    Dim msgText As String, minDetSize As String
    Dim itemKeys As New Collection
    Dim itemCounts As New Collection
    Dim itemTypes As New Collection
    Dim currentCount As Long
    Dim i As Long, k As Long
    Dim keyStr As String

    Set doc = ActiveDocument
    Set oldBlock = doc.ActivePage.FindShapes(Name:="Order_Artistic_Text_Block")
    If oldBlock.count > 0 Then oldBlock.Delete

    underscorePos = InStr(fileKey, "_")
    If underscorePos > 0 Then
        orderNumber = Left(fileKey, underscorePos - 1)
        customerName = Mid(fileKey, underscorePos + 1)
    Else
        orderNumber = fileKey
        customerName = "Не определен"
    End If

    complexMat = ComplexMaterials()
    simpleMat = SimpleMaterials()

    Set regEx = CreateObject("VBScript.RegExp")
    regEx.Pattern = "(\d+)[\s]*[xхXХ\*][\s]*(\d+)"
    regEx.IgnoreCase = True
    regEx.Global = True

    For Each sh In doc.ActivePage.FindShapes(Type:=cdrTextShape)
        If sh.Text.Story.Length > 0 Then
            If sh.Text.Story.Characters(1).Size > LABEL_MIN_SIZE Then
                txtContent = Trim(sh.Text.Story.Text)

                ' пропускаем сам блок заказа
                If InStr(1, txtContent, "Номер заказа:", vbTextCompare) = 0 And _
                   InStr(1, txtContent, "Заказчик:", vbTextCompare) = 0 And _
                   InStr(1, txtContent, "Материал:", vbTextCompare) = 0 Then

                    cleanText = Replace(txtContent, vbCrLf, " ")
                    cleanText = Replace(cleanText, vbCr, " ")
                    cleanText = Replace(cleanText, vbLf, " ")
                    Do While InStr(cleanText, "  ") > 0
                        cleanText = Replace(cleanText, "  ", " ")
                    Loop
                    cleanText = Trim(cleanText)

                    detW = 0: detH = 0
                    If regEx.Test(cleanText) Then
                        Set matches = regEx.Execute(cleanText)
                        detW = CDbl(matches(0).SubMatches(0))
                        detH = CDbl(matches(0).SubMatches(1))
                    End If

                    If detW > 0 And detH > 0 Then
                        matchedMaterial = ""
                        For i = LBound(complexMat) To UBound(complexMat)
                            If InStr(1, cleanText, complexMat(i), vbTextCompare) > 0 Then
                                matchedMaterial = complexMat(i)
                                Exit For
                            End If
                        Next i
                        If matchedMaterial = "" Then
                            For i = LBound(simpleMat) To UBound(simpleMat)
                                If InStr(1, cleanText, simpleMat(i), vbTextCompare) > 0 Then
                                    matchedMaterial = simpleMat(i)
                                    Exit For
                                End If
                            Next i
                        End If
                        matchedMaterial = AcrylDefault(matchedMaterial)

                        If matchedMaterial <> "" Then
                            calcResult = ProcessMaterialOutput(matchedMaterial, detW, detH)

                            ' деталь не помещается ни в один формат листа
                            If Left(calcResult, 6) = "ERROR:" Then
                                If detW <= detH Then
                                    minDetSize = detW & "x" & detH
                                Else
                                    minDetSize = detH & "x" & detW
                                End If
                                msgText = "Внимание! Деталь из материала '" & matchedMaterial & "' размером " & minDetSize & " мм " & _
                                          "не помещается ни в один стандартный формат листа." & vbCrLf & vbCrLf & "Всё равно продолжить?"
                                If MsgBox(msgText, vbYesNo + vbExclamation, "Превышение формата листа") = vbNo Then
                                    cancelled = True
                                    BuildOrderText = False
                                    Exit Function
                                End If
                                calcResult = Mid(calcResult, 7)
                            End If

                            pipePos = InStr(calcResult, "|")
                            parsedFormat = Left(calcResult, pipePos - 1)
                            parsedType = Mid(calcResult, pipePos + 1)
                            fullKey = matchedMaterial & " - " & parsedFormat

                            On Error Resume Next
                            itemKeys.Add fullKey, fullKey
                            If Err.Number = 0 Then
                                itemCounts.Add 1, fullKey
                                itemTypes.Add parsedType, fullKey
                            Else
                                currentCount = itemCounts(fullKey)
                                itemCounts.Remove fullKey
                                itemCounts.Add currentCount + 1, fullKey
                            End If
                            Err.Clear
                            On Error GoTo 0
                        End If
                    End If
                End If
            End If
        End If
    Next sh

    If itemKeys.count = 0 Then
        BuildOrderText = False
        Exit Function
    End If

    For k = 1 To itemKeys.count
        keyStr = itemKeys(k)
        materialsInfo = materialsInfo & keyStr & " - " & itemCounts(keyStr) & " " & itemTypes(keyStr) & vbCrLf
    Next k

    outText = "Номер заказа: " & orderNumber & vbCrLf & _
              "Заказчик: " & customerName & vbCrLf & _
              "Материал: " & vbCrLf & materialsInfo
    BuildOrderText = True
End Function

Private Sub DrawOrderBlock(ByVal txt As String)
    ' Блок "Фигурный текст" с заявкой в центре страницы (как раньше делал GenerateArtisticOrderText)
    Dim doc As Document
    Dim art As Shape
    Set doc = ActiveDocument
    doc.BeginCommandGroup "Блок материалов заказа"
    Set art = doc.ActivePage.ActiveLayer.CreateArtisticText(0, 0, txt)
    art.Name = "Order_Artistic_Text_Block"
    art.Text.FontProperties.Name = "Arial"
    art.Text.FontProperties.Size = 14
    art.SetPosition doc.ActivePage.centerX - (art.SizeWidth / 2), doc.ActivePage.centerY - (art.SizeHeight / 2)
    doc.EndCommandGroup
End Sub

Private Function AcrylDefault(ByVal m As String) As String
    ' Акрил без цвета = молочный
    Select Case m
        Case "Акрил 3 мм": m = "Акрил 3 мм (мол.)"
        Case "Акрил 5 мм": m = "Акрил 5 мм (мол.)"
        Case "Акрил 8 мм": m = "Акрил 8 мм (мол.)"
        Case "Акрил 10 мм": m = "Акрил 10 мм (мол.)"
    End Select
    AcrylDefault = m
End Function

' --- Подбор листа: меньший из подходящих; деталь >= 75% площади листа = целый лист (с размером детали в скобках) ---
Private Function ProcessMaterialOutput(matName As String, dW As Double, dH As Double) As String
    Dim itemMin As Double, itemMax As Double
    Dim sheets As Variant
    Dim bestW As Double, bestH As Double
    Dim minSheetArea As Double
    Dim i As Long
    Dim sMin As Double, sMax As Double
    Dim isFit As Boolean
    Dim currentArea As Double
    Dim nativeSizeStr As String
    Dim itemArea As Double, sheetArea As Double, ratio As Double

    If dW <= dH Then
        itemMin = dW: itemMax = dH
    Else
        itemMin = dH: itemMax = dW
    End If

    ' База стандартных листов (меньшая сторона, большая сторона)
    sheets = Array( _
        Array(1220, 2440), Array(2050, 3050), Array(1500, 2440), _
        Array(1500, 4000), Array(1220, 4000), Array(1500, 5000), _
        Array(600, 1200), Array(2070, 2750), Array(1250, 2050), _
        Array(615, 1240), Array(900, 1220), Array(1500, 1500))
    minSheetArea = 999999999

    For i = LBound(sheets) To UBound(sheets)
        sMin = sheets(i)(0): sMax = sheets(i)(1)
        isFit = False
        If InStr(1, matName, "ПЭТ", vbTextCompare) > 0 Then
            If sMin = 1250 And sMax = 2050 Then isFit = True
        Else
            If InStr(1, matName, "АКП", vbTextCompare) > 0 And (sMin = 1220 And sMax = 2440 Or sMin = 1500 And sMax = 4000 Or sMin = 1220 And sMax = 4000 Or sMin = 1500 And sMax = 5000) Then isFit = True
            If InStr(1, matName, "Акрил", vbTextCompare) > 0 And (sMin = 1220 And sMax = 2440 Or sMin = 2050 And sMax = 3050) Then isFit = True
            If InStr(1, matName, "ПВХ", vbTextCompare) > 0 And (sMin = 1220 And sMax = 2440 Or sMin = 2050 And sMax = 3050) Then isFit = True
            If InStr(1, matName, "Фанера", vbTextCompare) > 0 And (sMin = 1220 And sMax = 2440 Or sMin = 1500 And sMax = 2440 Or sMin = 1500 And sMax = 1500) Then isFit = True
            If InStr(1, matName, "Полик-нат", vbTextCompare) > 0 And (sMin = 2050 And sMax = 3050) Then isFit = True
            If InStr(1, matName, "АБС", vbTextCompare) > 0 And (sMin = 600 And sMax = 1200 Or sMin = 615 And sMax = 1240 Or sMin = 900 And sMax = 1220) Then isFit = True
            If InStr(1, matName, "ДСП", vbTextCompare) > 0 And (sMin = 2070 And sMax = 2750) Then isFit = True
        End If
        ' материал без своей таблицы листов - подходит любой лист
        If isFit = False And InStr(1, matName, "ПЭТ", vbTextCompare) = 0 And InStr(1, matName, "АКП", vbTextCompare) = 0 And _
           InStr(1, matName, "Акрил", vbTextCompare) = 0 And InStr(1, matName, "ПВХ", vbTextCompare) = 0 And _
           InStr(1, matName, "Фанера", vbTextCompare) = 0 And InStr(1, matName, "Полик-нат", vbTextCompare) = 0 And _
           InStr(1, matName, "АБС", vbTextCompare) = 0 And InStr(1, matName, "ДСП", vbTextCompare) = 0 Then
            isFit = True
        End If

        If isFit Then
            If itemMin <= sMin And itemMax <= sMax Then
                currentArea = sMax * sMin
                If i = 0 And InStr(1, matName, "ПЭТ", vbTextCompare) = 0 Then
                    bestW = sMax: bestH = sMin
                    Exit For
                ElseIf currentArea < minSheetArea Then
                    minSheetArea = currentArea
                    bestW = sMax: bestH = sMin
                End If
            End If
        End If
    Next i

    nativeSizeStr = CStr(CLng(itemMin)) & "x" & CStr(CLng(itemMax)) & " мм"
    If bestW = 0 Then
        ProcessMaterialOutput = "ERROR:" & nativeSizeStr & "|шт"
        Exit Function
    End If

    itemArea = itemMin * itemMax
    sheetArea = bestW * bestH
    ratio = itemArea / sheetArea
    If ratio >= 0.75 Then
        ProcessMaterialOutput = CStr(CLng(bestH)) & "х" & CStr(CLng(bestW)) & " мм (" & CStr(CLng(itemMin)) & "х" & CStr(CLng(itemMax)) & ")|листа"
    Else
        ProcessMaterialOutput = nativeSizeStr & "|шт"
    End If
End Function

' ============================================================
'  СПИСОК МАТЕРИАЛОВ (одно место для всего модуля)
' ============================================================

Private Function ComplexMaterials() As Variant
    ComplexMaterials = Array( _
        "ПВХ 3 мм (чёр.)", "ПВХ 5 мм (чёр.)", "АКП 3 мм (иск.сер.)", _
        "Акрил 2 мм (мол.)", "Акрил 2 мм (про.)", "Акрил 3 мм (мол.)", "Акрил 3 мм (про.)", _
        "Акрил 5 мм (мол.)", "Акрил 5 мм (про.)", "Акрил 8 мм (про.)", "Акрил 8 мм (мол.)", _
        "Акрил 10 мм (мол.)", "Акрил 10 мм (про.)", "Акрил 3 мм (гол.)", _
        "Акрил 3 мм (жёл.)", "Акрил 3 мм (зел.)", "Акрил 3 мм (кра.)", "Акрил 3 мм (ора.)", _
        "Акрил 3 мм (роз.)", "Акрил 3 мм (син.)", "Акрил 3 мм (зер.)", "Акрил 3 мм (чёр.)", _
        "Акрил 5 мм (чёр.)", "АКП 3 мм (дер.)", "АКП 3 мм (зол.)", "АКП 3 мм (кор.)", _
        "АКП 3 мм (кра.)", "АКП 3 мм (сер.)", "АКП 3 мм (серы.)", "АКП 3 мм (чёр.)", _
        "АБС 1 мм (зер.)", "АБС 1 мм (зол.)", "АБС 1 мм (брон.)", _
        "АБС 1 мм (сере.)", "АБС 1 мм (ц.зол.)", "АБС 1 мм (ц.сер.)")
End Function

Private Function SimpleMaterials() As Variant
    SimpleMaterials = Array( _
        "Полик-нат 3 мм", "Полик-нат 4 мм", "Полик-нат 5 мм", "Полик-нат 6 мм", _
        "ПЭТ 0,3 мм", "ПЭТ 0,7 мм", "ПЭТ 1 мм", "ПЭТ 2 мм", "ПЭТ 3 мм", _
        "Фанера 3 мм", "Фанера 4 мм", "Фанера 6 мм", "Фанера 10 мм", _
        "МДФ 8 мм", "МДФ 10 мм", "МДФ 16 мм", "МДФ 25 мм", "МДФ 50 мм", "ДСП 16 мм", _
        "ПВХ 1 мм", "ПВХ 2 мм", "ПВХ 3 мм", "ПВХ 5 мм", "ПВХ 8 мм", "ПВХ 10 мм", _
        "Акрил 3 мм", "Акрил 5 мм", "Акрил 8 мм", "Акрил 10 мм", _
        "АКП 3 мм", "АКП 4 мм", "АБС 1 мм", "Аллюминий", "Жесть")
End Function

Private Function IsKnownMaterial(ByVal m As String) As Boolean
    Dim lst As Variant
    Dim i As Long
    lst = ComplexMaterials()
    For i = LBound(lst) To UBound(lst)
        If StrComp(lst(i), m, vbTextCompare) = 0 Then
            IsKnownMaterial = True
            Exit Function
        End If
    Next i
    lst = SimpleMaterials()
    For i = LBound(lst) To UBound(lst)
        If StrComp(lst(i), m, vbTextCompare) = 0 Then
            IsKnownMaterial = True
            Exit Function
        End If
    Next i
End Function

' ============================================================
'  ОБЛАКО
' ============================================================

Private Function SendToCloud(material As String, detail As String, sheet As String, qty As String, note As String, category As String, cutLen As String, detLabel As String, isBrak As Boolean) As String
    ' Кладёт данные расхода в строку "<код>::inbox". Возвращает "" при успехе или текст ошибки.
    Dim stamp As String, payload As String

    stamp = NowStamp()
    payload = "{""id"":""" & NewUid() & """," & _
              """t"":""" & stamp & """," & _
              """mat"":""" & JsonStr(material) & """," & _
              """det"":""" & JsonStr(detail) & """," & _
              """sheet"":""" & JsonStr(sheet) & """," & _
              """qty"":" & CLng(Val(qty)) & "," & _
              """note"":""" & JsonStr(note) & """," & _
              """order"":""" & JsonStr(note) & """," & _
              """cat"":""" & JsonStr(category) & """," & _
              """cut"":""" & JsonStr(cutLen) & """," & _
              """detLabel"":""" & JsonStr(detLabel) & """"
    If isBrak Then payload = payload & ",""brak"":1"
    payload = payload & "}"

    SendToCloud = PostRow(ACCESS_CODE & "::inbox", payload, stamp)
End Function

Private Function SendPlanToCloud(orderKey As String, planText As String, ByRef msgId As String) As String
    ' Заявка для раздела ПЛАН (строка "<код>::plan"). msgId - номер сообщения, по нему ждём ответ приложения.
    Dim stamp As String, payload As String

    stamp = NowStamp()
    msgId = NewUid()
    payload = "{""id"":""" & msgId & """," & _
              """t"":""" & stamp & """," & _
              """order"":""" & JsonStr(orderKey) & """," & _
              """text"":""" & JsonStr(planText) & """}"

    SendPlanToCloud = PostRow(ACCESS_CODE & "::plan", payload, stamp)
End Function

Private Function SendCommandToCloud(action As String, orderKey As String) As String
    ' Команда для приложения (строка "<код>::cmd"), например closeOrder.
    Dim stamp As String, payload As String

    stamp = NowStamp()
    payload = "{""id"":""" & NewUid() & """," & _
              """t"":""" & stamp & """," & _
              """action"":""" & JsonStr(action) & """," & _
              """order"":""" & JsonStr(orderKey) & """}"

    SendCommandToCloud = PostRow(ACCESS_CODE & "::cmd", payload, stamp)
End Function

Private Function PostRow(rowId As String, payloadJson As String, stamp As String) As String
    ' Записывает (или обновляет) строку таблицы material_data. Возвращает "" при успехе или текст ошибки.
    On Error GoTo EH

    Dim http As Object
    Dim body As String

    body = "{""id"":""" & JsonStr(rowId) & """,""payload"":" & payloadJson & ",""updated_at"":""" & stamp & """}"

    Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
    http.setTimeouts 5000, 5000, 10000, 10000
    http.Open "POST", SB_URL & "/rest/v1/material_data", False
    http.setRequestHeader "apikey", SB_KEY
    http.setRequestHeader "Authorization", "Bearer " & SB_KEY
    http.setRequestHeader "Content-Type", "application/json"
    http.setRequestHeader "Prefer", "resolution=merge-duplicates,return=minimal"
    http.send body

    If http.Status >= 200 And http.Status < 300 Then
        PostRow = ""
    Else
        PostRow = "HTTP " & http.Status & ": " & Left(http.responseText, 150)
    End If
    Exit Function

EH:
    PostRow = "нет связи с облаком (" & Err.description & ")"
End Function

Private Function HttpGet(url As String) As String
    On Error GoTo EH
    Dim http As Object
    Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
    http.setTimeouts 5000, 5000, 8000, 8000
    http.Open "GET", url, False
    http.setRequestHeader "apikey", SB_KEY
    http.setRequestHeader "Authorization", "Bearer " & SB_KEY
    http.send
    If http.Status >= 200 And http.Status < 300 Then HttpGet = http.responseText
    Exit Function
EH:
    HttpGet = ""
End Function

Private Function WaitReply(ByVal msgId As String) As String
    ' Ждёт ответ приложения (строка "<код>::reply") с тем же номером сообщения; возвращает текст или ""
    Dim i As Long
    Dim resp As String
    For i = 1 To REPLY_WAIT_SEC
        Sleep 1000
        DoEvents
        resp = HttpGet(SB_URL & "/rest/v1/material_data?id=eq." & UrlEncodeUtf8(ACCESS_CODE & "::reply") & "&select=payload")
        If InStr(resp, """id"":""" & msgId & """") > 0 Then
            WaitReply = JsonGetString(resp, "text")
            Exit Function
        End If
    Next i
End Function

Private Function JsonGetString(ByVal json As String, ByVal key As String) As String
    ' Значение строкового поля из JSON-ответа (с разбором \n, \" и \uXXXX)
    Dim p As Long, i As Long
    Dim c As String, res As String, hexv As String
    p = InStr(json, """" & key & """:""")
    If p = 0 Then Exit Function
    i = p + Len(key) + 4
    Do While i <= Len(json)
        c = Mid$(json, i, 1)
        If c = "\" Then
            i = i + 1
            c = Mid$(json, i, 1)
            Select Case c
                Case "n": res = res & vbCrLf
                Case "t": res = res & " "
                Case "u"
                    hexv = Mid$(json, i + 1, 4)
                    res = res & ChrW$(CLng("&H" & hexv & "&"))
                    i = i + 4
                Case Else: res = res & c
            End Select
        ElseIf c = """" Then
            Exit Do
        Else
            res = res & c
        End If
        i = i + 1
    Loop
    JsonGetString = res
End Function

Private Function NowStamp() As String
    NowStamp = Format(Now, "yyyy-mm-dd") & "T" & Format(Now, "hh:nn:ss")   ' местное время этого компьютера
End Function

Private Function NewUid() As String
    NewUid = Format(Now, "yyyymmddhhnnss") & Format(Int((Timer - Int(Timer)) * 1000), "000")
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
    If note <> "" Then url = url & "&note=" & UrlEncodeUtf8(note) & "&order=" & UrlEncodeUtf8(note)
    If ShellExecute(0, "open", url, vbNullString, vbNullString, 1) <= 32 Then
        MsgBox "Не удалось открыть приложение по адресу:" & vbCrLf & APP_URL, vbCritical
    End If
End Sub

Private Function OrderKeyFromPath(ByVal filePath As String) As String
    ' Имя файла из пути без расширения: Октябрь 2026\14.10.2026\9-10-53_ЦЗН Охотск_Постеры.cdr -> 9-10-53_ЦЗН Охотск_Постеры
    Dim p As Long
    filePath = Trim(filePath)
    If filePath = "" Then Exit Function
    p = InStrRev(filePath, "\")
    If p > 0 Then filePath = Mid(filePath, p + 1)
    p = InStrRev(filePath, "/")
    If p > 0 Then filePath = Mid(filePath, p + 1)
    If LCase(Right(filePath, 4)) = ".cdr" Then filePath = Left(filePath, Len(filePath) - 4)
    OrderKeyFromPath = Trim(filePath)
End Function

Private Function ParseTextDataApp(ByVal textContent As String, ByRef parts() As String, ByRef filePath As String) As Boolean
    ' Текст делится по "_", после 8-го подчёркивания идёт путь к файлу
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
    filePath = Mid(textContent, cutPos + 1)
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
    ' Кодирование в %XX (UTF-8)
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

' ============================================================
'  ПРОВЕРКА ПОДПИСИ ДЕТАЛИ
' ============================================================

' Возвращает "" если всё верно, иначе - понятное описание ошибки. key = имя файла (заказ)
Private Function ValidateLabel(ByVal t As String, ByRef key As String) As String
    Dim n As Long
    Dim i As Long
    Dim cutPos As Long
    Dim arr As Variant
    Dim re As Object
    Dim m As String

    t = Trim(t)
    For i = 1 To Len(t)
        If Mid(t, i, 1) = "_" Then
            n = n + 1
            If n = 8 Then
                cutPos = i
                Exit For
            End If
        End If
    Next i
    If n < 8 Then
        ValidateLabel = "В тексте только " & n & " символов ""_"", а нужно не меньше 8 (после длины реза идёт путь к файлу)."
        Exit Function
    End If

    arr = Split(Left(t, cutPos - 1), "_")
    If UBound(arr) < 7 Then
        ValidateLabel = "Не удалось разделить подпись на части."
        Exit Function
    End If

    Set re = CreateObject("VBScript.RegExp")
    re.IgnoreCase = True

    ' 1. Номер заказа
    re.Pattern = "^\d{1,2}-\d{2}-\d{1,4}$"
    If Not re.Test(Trim(arr(0))) Then
        ValidateLabel = "1-я часть (номер заказа) должна быть вида 9-10-53, а здесь: """ & Trim(arr(0)) & """."
        Exit Function
    End If
    ' 2. Заказчик, 3. Что именно
    If Trim(arr(1)) = "" Then
        ValidateLabel = "2-я часть (заказчик) пустая."
        Exit Function
    End If
    If Trim(arr(2)) = "" Then
        ValidateLabel = "3-я часть (что именно) пустая."
        Exit Function
    End If
    ' 4. Материал
    m = NormSpaces(CStr(arr(3)))
    If Not IsKnownMaterial(m) Then
        ValidateLabel = "4-я часть (материал) """ & m & """ не найдена в списке материалов." & vbCrLf & _
                        "Проверьте название (например, ""ПВХ 3 мм"" или ""Акрил 3 мм (мол.)"")."
        Exit Function
    End If
    ' 5. Размер детали (обязателен)
    re.Pattern = "^(\d{2,5})\s*[xхXХ\xD7\*]\s*(\d{2,5})$"
    If Not re.Test(Trim(arr(4))) Then
        ValidateLabel = "5-я часть (размер детали) должна быть вида 1194х2285, а здесь: """ & Trim(arr(4)) & """."
        Exit Function
    End If
    ' 6. Размер листа (можно пусто)
    If Trim(arr(5)) <> "" Then
        If Not re.Test(Trim(arr(5))) Then
            ValidateLabel = "6-я часть (размер листа) должна быть пустой или вида 1220х2440, а здесь: """ & Trim(arr(5)) & """."
            Exit Function
        End If
    End If
    ' 7. Количество листов (можно пусто)
    If Trim(arr(6)) <> "" Then
        re.Pattern = "^\d{1,3}$"
        If Not re.Test(Trim(arr(6))) Then
            ValidateLabel = "7-я часть (кол-во листов) должна быть пустой или целым числом, а здесь: """ & Trim(arr(6)) & """."
            Exit Function
        End If
        If CLng(Trim(arr(6))) < 1 Then
            ValidateLabel = "7-я часть (кол-во листов) должна быть не меньше 1."
            Exit Function
        End If
    End If

    ' 8. Длина реза (можно пусто, число в мм)
    If Trim(arr(7)) <> "" Then
        If Not IsNumeric(Trim(arr(7))) Then
            ValidateLabel = "8-я часть (длина реза) должна быть пустой или числом в мм, а здесь: """ & Trim(arr(7)) & """."
            Exit Function
        End If
    End If

    ' Ключ заказа = имя файла из пути в конце подписи (без расширения .cdr)
    Dim fileBase As String
    Dim p As Long
    fileBase = Trim(Mid(t, cutPos + 1))
    p = InStrRev(fileBase, "\")
    If p > 0 Then fileBase = Mid(fileBase, p + 1)
    p = InStrRev(fileBase, "/")
    If p > 0 Then fileBase = Mid(fileBase, p + 1)
    If LCase(Right(fileBase, 4)) = ".cdr" Then fileBase = Left(fileBase, Len(fileBase) - 4)
    fileBase = Trim(fileBase)
    If fileBase = "" Then
        ValidateLabel = "В конце подписи не найден путь к файлу (после 8-го ""_"")."
        Exit Function
    End If
    If LCase(Split(fileBase, "_")(0)) <> LCase(Trim(arr(0))) Then
        ValidateLabel = "Номер заказа в подписи (" & Trim(arr(0)) & ") не совпадает с номером в имени файла (" & Split(fileBase, "_")(0) & ")."
        Exit Function
    End If
    key = fileBase
    ValidateLabel = ""
End Function

Private Function NormSpaces(ByVal s As String) As String
    s = Trim(s)
    Do While InStr(s, "  ") > 0
        s = Replace(s, "  ", " ")
    Loop
    NormSpaces = s
End Function

