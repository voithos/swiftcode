module.exports = function(hljs) {
  return {
    keywords: {
        keyword: 'auto break case char const continue default do double ' +
            'else enum extern float for goto if inline int long register restrict return ' +
            'short signed sizeof static struct switch typedef union unsigned ' +
            'void volatile while _Bool _Complex _Imaginary',
        built_in: 'abort abs acos asin atan2 atan calloc ceil cosh cos exit ' +
            'exp fabs floor fmod fprintf fputs free frexp fscanf isalnum isalpha ' +
            'iscntrl isdigit isgraph islower isprint ispunct isspace isupper ' +
            'isxdigit tolower toupper labs ldexp log10 log malloc memchr ' +
            'memcmp memcpy memset modf pow printf putchar puts scanf sinh ' +
            'sin snprintf sprintf sqrt sscanf strcat strchr strcmp strcpy ' +
            'strcspn strlen strncat strncmp strncpy strpbrk strrchr strspn ' +
            'strstr tanh tan vfprintf vprintf vsprintf'
    },
    illegal: '</',
    contains: [
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      hljs.QUOTE_STRING_MODE,
      {
        className: 'string',
        begin: '\'\\\\?.', end: '\'',
        illegal: '.'
      },
      {
        className: 'number',
        begin: '\\b(\\d+(\\.\\d*)?|\\.\\d+)(u|U|l|L|ul|UL|f|F)'
      },
      hljs.C_NUMBER_MODE,
      {
        className: 'preprocessor',
        begin: '#', end: '$',
        contains: [
          {begin: '<', end: '>', illegal: '\\n'},
          hljs.C_LINE_COMMENT_MODE
        ]
      }
    ]
  };
};