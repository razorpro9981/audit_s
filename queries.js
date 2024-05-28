// queries.js
const queries = {
  auditTrail: `
    SELECT *
    FROM (
      SELECT a.*, ROWNUM rnum
      FROM (SELECT username,  userhost, obj_name, action, action_name, priv_used, extended_timestamp, entryid
        FROM DBA_AUDIT_TRAIL) a
      WHERE ROWNUM <= :maxRows
    )
    WHERE rnum >= :offset`,

  auditUnified: `
    SELECT *
    FROM (
      SELECT a.*, ROWNUM rnum
      FROM (SELECT AUDIT_TYPE, OS_USERNAME, EVENT_TIMESTAMP, USERHOST, DBUSERNAME, ACTION_NAME
        FROM AUDSYS.AUD$UNIFIED) a
      WHERE ROWNUM <= :maxRows
    )
    WHERE rnum >= :offset
    `,
  auditUnifiedTrail: `
    SELECT *
    FROM (
      SELECT a.*, ROWNUM rnum
      FROM (SELECT AUDIT_TYPE, OS_USERNAME, SESSIONID, USERHOST, event_timestamp, action_name 
        FROM UNIFIED_AUDIT_TRAIL ORDER BY event_timestamp DESC) a
      WHERE ROWNUM <= :maxRows
    )
    WHERE rnum >= :offset
    `,

  x2: `
    SELECT *
    FROM (
      SELECT a.*, ROWNUM rnum
      FROM (SELECT AUDIT_TYPE,
    SESSIONID,
    OS_USERNAME,
    USERHOST,
    TERMINAL,
    INSTANCE_ID,
    DBID,
    AUTHENTICATION_TYPE,
    DBUSERNAME,
    CLIENT_PROGRAM_NAME,
    ENTRY_ID,
    STATEMENT_ID,
    EVENT_TIMESTAMP,
    EVENT_TIMESTAMP_UTC,
    ACTION_NAME,
    RETURN_CODE,
    OS_PROCESS,
    TRANSACTION_ID,
    SCN,
    OBJECT_SCHEMA
        FROM UNIFIED_AUDIT_TRAIL ORDER BY event_timestamp DESC) a
      WHERE ROWNUM <= :maxRows
    )
    WHERE rnum >= :offset
    `,

  x3: ` 
    SELECT *
FROM (
    SELECT a.*, ROWNUM rnum
    FROM (
        SELECT 
            AUDIT_TYPE,
            SESSIONID,
            OS_USERNAME,
            USERHOST,
            TERMINAL,
            INSTANCE_ID,
            DBID,
            AUTHENTICATION_TYPE,
            DBUSERNAME,
            CLIENT_PROGRAM_NAME,
            ENTRY_ID,
            STATEMENT_ID,
            EVENT_TIMESTAMP,
            EVENT_TIMESTAMP_UTC,
            ACTION_NAME,
            RETURN_CODE,
            OS_PROCESS,
            TRANSACTION_ID,
            SCN,
            OBJECT_SCHEMA,
            ROW_NUMBER() OVER (ORDER BY EVENT_TIMESTAMP DESC) AS rn
        FROM UNIFIED_AUDIT_TRAIL
       -- WHERE TRUNC(EVENT_TIMESTAMP) = TRUNC(SYSDATE) -- Filter for the current day
    ) a
    WHERE ROWNUM <= :maxRows AND rn >= :offset
)
`,

  dbmsquery: `
select OS_USER,sessionid,EVENT_TIMESTAMP,DBMS_LOB.SUBSTR(sql_text,4000,1) from AUDSYS.AUD$UNIFIED where  sessionid=':sessionid' and event_timestamp=TO_TIMESTAMP(':event_timestamp','YYYY-MM-DD HH24:MI:SS.FF')`,

  createTable: `
    CREATE TABLE \${tableName} (
      AUDIT_TYPE VARCHAR(50),
      SESSIONID VARCHAR(50),
      OS_USERNAME VARCHAR(50),
      USERHOST VARCHAR(50),
      TERMINAL VARCHAR(50),
      INSTANCE_ID VARCHAR(50),
      DBID VARCHAR(50),
      AUTHENTICATION_TYPE VARCHAR(50),
      DBUSERNAME VARCHAR(50),
      CLIENT_PROGRAM_NAME VARCHAR(255),
      ENTRY_ID VARCHAR(50),
      STATEMENT_ID VARCHAR(50),
      EVENT_TIMESTAMP DATETIME(6),
      EVENT_TIMESTAMP_UTC DATETIME(6),
      ACTION_NAME VARCHAR(50),
      RETURN_CODE INT,
      OS_PROCESS VARCHAR(50),
      TRANSACTION_ID VARCHAR(50),
      SCN VARCHAR(50),
      OBJECT_SCHEMA VARCHAR(50),
      rnum INT,
      uuid varchar(50), 
      sql_text text
    )
  `,

  insertQuery: `
  INSERT INTO audit (
    AUDIT_TYPE, SESSIONID, OS_USERNAME, USERHOST, TERMINAL, INSTANCE_ID, DBID,
    AUTHENTICATION_TYPE, DBUSERNAME, CLIENT_PROGRAM_NAME, ENTRY_ID, STATEMENT_ID,
    EVENT_TIMESTAMP, EVENT_TIMESTAMP_UTC, ACTION_NAME, RETURN_CODE,
    OS_PROCESS, TRANSACTION_ID, SCN, OBJECT_SCHEMA, rnum, uuid, sql_text
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?);

  `,

  insertQuery111: `
    INSERT INTO audit_trail (
        AUDIT_TYPE,
        SESSIONID,
        PROXY_SESSIONID,
        OS_USERNAME,
        USERHOST,
        TERMINAL,
        INSTANCE_ID,
        DBID,
        AUTHENTICATION_TYPE,
        DBUSERNAME,
        DBPROXY_USERNAME,
        EXTERNAL_USERID,
        GLOBAL_USERID,
        CLIENT_PROGRAM_NAME,
        DBLINK_INFO,
        XS_USER_NAME,
        XS_SESSIONID,
        ENTRY_ID,
        STATEMENT_ID,
        EVENT_TIMESTAMP,
        EVENT_TIMESTAMP_UTC,
        ACTION_NAME,
        RETURN_CODE,
        OS_PROCESS,
        TRANSACTION_ID,
        SCN,
        EXECUTION_ID,
        OBJECT_SCHEMA,
        OBJECT_NAME,
        SQL_TEXT,
        SQL_BINDS,
        APPLICATION_CONTEXTS,
        CLIENT_IDENTIFIER,
        NEW_SCHEMA,
        NEW_NAME,
        OBJECT_EDITION,
        SYSTEM_PRIVILEGE_USED,
        SYSTEM_PRIVILEGE,
        AUDIT_OPTION,
        OBJECT_PRIVILEGES,
        ROLE,
        TARGET_USER,
        EXCLUDED_USER,
        EXCLUDED_SCHEMA,
        EXCLUDED_OBJECT,
        "CURRENT_USER",
        ADDITIONAL_INFO,
        UNIFIED_AUDIT_POLICIES,
        FGA_POLICY_NAME,
        XS_INACTIVITY_TIMEOUT,
        XS_ENTITY_TYPE,
        XS_TARGET_PRINCIPAL_NAME,
        XS_PROXY_USER_NAME,
        XS_DATASEC_POLICY_NAME,
        XS_SCHEMA_NAME,
        XS_CALLBACK_EVENT_TYPE,
        XS_PACKAGE_NAME,
        XS_PROCEDURE_NAME,
        XS_ENABLED_ROLE,
        XS_COOKIE,
        XS_NS_NAME,
        XS_NS_ATTRIBUTE,
        XS_NS_ATTRIBUTE_OLD_VAL,
        XS_NS_ATTRIBUTE_NEW_VAL,
        DV_ACTION_CODE,
        DV_ACTION_NAME,
        DV_EXTENDED_ACTION_CODE,
        DV_GRANTEE,
        DV_RETURN_CODE,
        DV_ACTION_OBJECT_NAME,
        DV_RULE_SET_NAME,
        DV_COMMENT,
        DV_FACTOR_CONTEXT,
        DV_OBJECT_STATUS,
        OLS_POLICY_NAME,
        OLS_GRANTEE,
        OLS_MAX_READ_LABEL,
        OLS_MAX_WRITE_LABEL,
        OLS_MIN_WRITE_LABEL,
        OLS_PRIVILEGES_GRANTED,
        OLS_PROGRAM_UNIT_NAME,
        OLS_PRIVILEGES_USED,
        OLS_STRING_LABEL,
        OLS_LABEL_COMPONENT_TYPE,
        OLS_LABEL_COMPONENT_NAME,
        OLS_PARENT_GROUP_NAME,
        OLS_OLD_VALUE,
        OLS_NEW_VALUE,
        RMAN_SESSION_RECID,
        RMAN_SESSION_STAMP,
        RMAN_OPERATION,
        RMAN_OBJECT_TYPE,
        RMAN_DEVICE_TYPE,
        DP_TEXT_PARAMETERS1,
        DP_BOOLEAN_PARAMETERS1,
        DIRECT_PATH_NUM_COLUMNS_LOADED,
        RLS_INFO,
        KSACL_USER_NAME,
        KSACL_SERVICE_NAME,
        KSACL_SOURCE_LOCATION,
        PROTOCOL_SESSION_ID,
        PROTOCOL_RETURN_CODE,
        PROTOCOL_ACTION_NAME,
        PROTOCOL_USERHOST,
        PROTOCOL_MESSAGE
    ) 
    VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,
        $31,$32,$33,$34,$35,$36,$37,$38,$39,$40,
        $41,$42,$43,$44,$45,$46,$47,$48,$49,$50,
        $51,$52,$53,$54,$55,$56,$57,$58,$59,$60,
        $61,$62,$63,$64,$65,$66,$67,$68,$69,$70,
        $71,$72,$73,$74,$75,$76,$77,$78,$79,$80,
        $81,$82,$83,$84,$85,$86,$87,$88,$89,$90,
        $91,$92,$93,$94,$95,$96,$97,$98,$99,$100, 
        $101,$102,$103,$104,$105,$106
    );
  `,

  valuesArray: `
  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,
        $31,$32,$33,$34,$35,$36,$37,$38,$39,$40,
        $41,$42,$43,$44,$45,$46,$47,$48,$49,$50,
        $51,$52,$53,$54,$55,$56,$57,$58,$59,$60,
        $61,$62,$63,$64,$65,$66,$67,$68,$69,$70,
        $71,$72,$73,$74,$75,$76,$77,$78,$79,$80,
        $81,$82,$83,$84,$85,$86,$87,$88,$89,$90,
        $91,$92,$93,$94,$95,$96,$97,$98,$99,$100, 
        $101,$102,$103,$104,$105,$106
  `,
  x4: ` 
  
    SELECT *
    FROM (
    SELECT a.*, ROWNUM rnum
    FROM (
        SELECT 
            uni.AUDIT_TYPE,
           uni.SESSIONID,
            uni.OS_USERNAME,
            uni.USERHOST,
            uni.TERMINAL,
            uni.INSTANCE_ID,
            uni.DBID,
            uni.AUTHENTICATION_TYPE,
            uni.DBUSERNAME,
            uni.CLIENT_PROGRAM_NAME,
            uni.ENTRY_ID,
            uni.STATEMENT_ID,
            uni.EVENT_TIMESTAMP,
            uni.EVENT_TIMESTAMP_UTC,
            uni.ACTION_NAME,
            uni.RETURN_CODE,
            uni.OS_PROCESS,
            uni.TRANSACTION_ID,
            uni.SCN,
            uni.OBJECT_SCHEMA,
            
            dbms_lob.substr(aud.sql_text, 4000, 1) as sql_text,
        ROW_NUMBER() OVER (ORDER BY uni.EVENT_TIMESTAMP DESC) AS rn
        FROM UNIFIED_AUDIT_TRAIL uni 
        left join AUDSYS.AUD$UNIFIED aud on uni.SESSIONID = aud.SESSIONID and uni.EVENT_TIMESTAMP = aud.EVENT_TIMESTAMP  
        --where uni.sessionid='1293437292' and uni.event_timestamp=TO_TIMESTAMP('6/30/2023 11:08:59.961342 PM', 'MM/DD/YYYY HH:MI:SS.FF AM')
       -- WHERE TRUNC(EVENT_TIMESTAMP) = TRUNC(SYSDATE) -- Filter for the current day
    ) a
    WHERE ROWNUM <= :maxRows AND rn >= :offset
)  `,
};

module.exports = queries;
